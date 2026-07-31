---
paths:
  - "**/*.spec.*"
  - "**/*.test.*"
  - "**/tests/**"
  - "src/mocks/**"
---

# Testing

Three Vitest projects (`vite.config.ts`), all run by `npm test`:

- **client** — jsdom, `src/**`. Feature tests in `src/features/<feature>/tests/`, render helpers in `src/tests/utils.ts`.
- **server** — node, `lib/**` and `netlify/functions/utils/**`. Pure functions only; no database.
- **integration** — node, `netlify/functions/tests/**`. Every Netlify handler against a real CockroachDB.

`npm run test:unit` skips the integration project — **the rest of `npm test` needs Docker running**, because integration starts a container.

## What `src/tests/setup.ts` does for you

Read it before writing a test — it makes several things global, which explains behavior that otherwise looks like magic:

- **`vue-router` is mocked wholesale.** `useRoute()` always returns `params.clubSlug === "test-club"`, and `useRouter().push` returns a resolved Promise. Don't set up a real router; do assert against those stubs for navigation.
- **A Pinia helper component is rendered before every test**, so stores are initialized without per-test setup.
- **`window.matchMedia` is stubbed** to always report `matches: false` — media-query-driven branches take the false path unless you override it.
- **MSW is started once and `resetHandlers()` runs after each test**, so per-test `server.use(...)` overrides don't leak.

API calls are mocked with MSW — handlers in `src/mocks/handlers.ts`, fixtures in `src/mocks/data/`. **`onUnhandledRequest: "error"`**: a request with no handler fails the test, usually surfacing as a ~1s `waitFor` timeout. Add the handler with `server.use(...)` inside the test; never edit the shared handler file for one case. Error paths need an explicit 500 handler, and TanStack Query retries a failed query 3× by default.

`createTestingPinia()` stubs every store action to a no-op spy returning `undefined`. A component chaining `.then/.catch` on one (`auth.refreshSession().catch(...)`) crashes unless the test does `vi.mocked(store.action).mockResolvedValue(undefined)` first — and state an action stub was supposed to change never changes.

## Client gotchas that cost an hour each

- **`IntersectionObserver`** doesn't exist in jsdom, and `v-lazy-load` / `v-reveal` construct one on mount. Call `mockIntersectionObserver()` (`@/mocks/IntersectionObserver`) at the top of any spec rendering them or the mount throws and later tests fail with confusing leftover-DOM errors. It defaults to never firing, which parks a lazy image's URL in `data-src` with an empty `src`; pass `{ intersecting: true }` to assert the resolved `src`.
- **AG Charts** paints into a `<canvas>` jsdom cannot provide and throws on both mount and unmount. Opt into the stub with `vi.mock("ag-charts-vue3", async () => await import("@/mocks/agCharts"))` — the dynamic import avoids the TDZ error a static one hits under `vi.mock` hoisting. It renders `role="img"` and exposes `chartOptions(el)` / `chartSeriesNames(el)`; detailed option assertions belong in `chartOptions.spec.ts`.
- **Clipboard:** `userEvent.setup()` — which `render()` always calls — installs its own `navigator.clipboard`, silently replacing a spy stubbed in `beforeEach`. The test then fails with "0 calls" while a success toast proves the copy happened. Spy _after_ `render()`.
- **`GalleryView`** takes a live TanStack table, and `useVueTable` needs a component instance, so one cannot be built in module scope. Use `withReviewTable()` from `src/features/reviews/tests/reviewTable.ts`.
- **Statistics fixtures** live in `src/features/statistics/tests/fixtures.ts`. Two thresholds bite: `computeScoreTrend` reads `work.scores` (timestamped), not `work.userScores`, and both rolling charts use a window of `Math.max(5, …)` — so trend/spread need six scored reviews before they plot anything.

## Integration tests (`netlify/functions/tests/`)

**Arrange and assert through the same interfaces a client has.** No `vi.mock` of repositories, `utils/database` or `utils/auth`, and no direct database reads — a test that queries a table is asserting an implementation detail, and one that seeds a table is describing a state the app may not even be able to produce. `helpers/database.ts` deliberately does not export the Kysely handle.

Real: the routers, `validClubSlug` / `validListId`, BetterAuth's `loggedIn` / `secured`, every repository, Kysely, the migrated schema. Faked, and only at the network boundary via MSW: TMDB, Google Books, Gemini, Resend, Cloudinary — with `onUnhandledRequest: "error"`, so a call to any other host fails the test.

| Path | Purpose |
| --- | --- |
| `setup/globalSetup.ts` | Starts the container once per run, migrates it via `npx tsx ./migrations/schemaMigrator.ts` |
| `setup/env.ts` | Points `DATABASE_URL` / `DATABASE_URL_ROOT` at it. **Must be imported before anything reaching `utils/database.ts`**, which builds its pool at import time |
| `setup/integration.ts` | Per-file setup: starts MSW, resets the database before each test, undoes profile edits after |
| `setup/externalApis.ts` | The MSW server, its handlers, `requestsTo(host)` and `sentEmails` |
| `fixtures/external.ts` | `tmdbMovie()` / `googleBooksVolume()` / `geminiJsonResponse()` payload builders |
| `helpers/http.ts` | `requester(handler)` → `.get/.post/.put/.delete`, plus `makeEvent()` / `send()` |
| `helpers/auth.ts` | `signIn("alice" \| "bob" \| …)` → a real signed session cookie |
| `helpers/factories.ts` | `createClub`, `addWork`, `scoreWork`, `addComment`, … — all driving real endpoints |
| `helpers/database.ts` | `resetDatabase()` only |

```ts
const api = requester(handler);

it("renames the club", async () => {
  const alice = await signIn("alice");
  const club = await createClub(alice);

  const res = await api.put(`/api/club/${club.slug}/name`, { body: { name: "New" }, as: alice });

  expect(res.statusCode).toBe(200);
  expect((await api.get<ClubPreview>(`/api/club/${club.slug}`)).body.clubName).toBe("New");
});
```

- **`signIn()` is the real thing**: it posts to `/api/auth/sign-up/email`, follows the link out of the verification email BetterAuth sends (captured at Resend's endpoint), and posts to `/api/auth/sign-in/email`. The `as:` cookie is the cookie a browser would hold. Omit `as` for an anonymous request; pass `headers: { cookie: "better-auth.session_token=bogus" }` for an invalid one.
- **Assert a write by reading it back** through the endpoint a client would use — the club preview for a rename, the members list for a profile change, `GET /awards/:year` for an awards write.
- **The factories drive endpoints too**, so a bug in the write path fails the test rather than being papered over by a hand-built row.
- **`requestsTo(host)`** is how cache behaviour gets asserted: re-adding a known movie must make no second TMDB call.

**The two justified exceptions**, both in `helpers/factories.ts` and both commented there: `expireInvite()` (nothing can shorten a 24-hour token) and `createAwardsYear()` (no endpoint opens a year). `scheduled-db-cleanup.test.ts` issues `CREATE DATABASE` for the same reason — its subject operates on databases, not rows. Anything else reaching for the database is a smell; find the endpoint instead.

Gotchas:

- Isolation is `resetDatabase()` between tests, deleting every domain table. Its table list is typed `satisfies readonly DomainTable[]` with an exhaustiveness check, so `npm run codegen` adding a table fails type-check until someone decides whether it should be cleared.
- The auth tables survive on purpose — signing a user up costs two bcrypt hashes, so the fixture users are created once and reused; `restoreFixtureUsers()` undoes profile edits through the profile endpoints.
- Files run serially (`fileParallelism: false`); they share one database. No `describe.concurrent`.
- **CockroachDB v25+ required.** On v24.1 the `20260407_ArbitraryClubLists` migration fails from scratch — the `DROP COLUMN` schema-change job is still in flight when the `DROP TYPE` runs. Override with `COCKROACH_TEST_IMAGE`.
- An error thrown inside a handler becomes a 500 (the router catches it). `executeTakeFirstOrThrow` on a missing row is the usual cause.
- `MovieDataSummary` has no `title` — the summary query does not select `movie_details.title`. Assert on `tagline` or `overview` instead.

## Environment-dependent tests

To simulate a missing secret, use `vi.stubEnv(KEY, "")` rather than `vi.unstubAllEnvs()`. The latter passes locally but fails on Netlify, where the real secret is injected into the environment.

## Prefer a real dependency to a mocked one

A mocked repository can only confirm that the handler calls the function the test told it to expect. If a test needs a stub to be meaningful, that is usually a sign the thing under test should be exercised through its real collaborators instead. Mock at the boundary — the network — not between your own modules.
