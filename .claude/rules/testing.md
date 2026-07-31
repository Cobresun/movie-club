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
- **`GalleryView` / `TableView`** take a live TanStack table, and `useVueTable` needs a component instance, so one cannot be built in module scope. Use `withReviewTable()` from `src/features/reviews/tests/reviewTable.ts`.
- **Statistics fixtures** live in `src/features/statistics/tests/fixtures.ts`. Two thresholds bite: `computeScoreTrend` reads `work.scores` (timestamped), not `work.userScores`, and both rolling charts use a window of `Math.max(5, …)` — so trend/spread need six scored reviews before they plot anything.

## Integration tests (`netlify/functions/tests/`)

**Do not `vi.mock` repositories, `utils/database`, or `utils/auth` here.** Mocking those is what the suite used to do, and it hid a live 404 on every awards write route because the mocks answered a URL shape the real router never matched.

Real: the routers, `validClubSlug` / `validListId`, BetterAuth's `loggedIn` / `secured`, every repository, Kysely, the migrated schema. Faked, and only at the network boundary via MSW: TMDB, Google Books, Gemini, Resend, Cloudinary — with `onUnhandledRequest: "error"`, so a call to any other host fails the test.

| Path                    | Purpose                                                                                                                                                    |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `setup/globalSetup.ts`  | Starts the container once per run, migrates it via `npx tsx ./migrations/schemaMigrator.ts`                                                                |
| `setup/env.ts`          | Points `DATABASE_URL` / `DATABASE_URL_ROOT` at it. **Must be imported before anything reaching `utils/database.ts`**, which builds its pool at import time |
| `setup/integration.ts`  | Per-file setup: starts MSW, resets the database before each test                                                                                           |
| `setup/externalApis.ts` | The MSW server, its default handlers, and `requestsTo(host)`                                                                                               |
| `fixtures/external.ts`  | `tmdbMovie()` / `googleBooksVolume()` / `geminiJsonResponse()` payload builders                                                                            |
| `helpers/http.ts`       | `requester(handler)` → `.get/.post/.put/.delete`, plus `makeEvent()` / `send()`                                                                            |
| `helpers/auth.ts`       | `signIn("alice" \| "bob" \| "carol")` → a real signed session cookie                                                                                       |
| `helpers/factories.ts`  | Row seeding: `createClub`, `createWork`, `addToList`, `createReview`, …                                                                                    |
| `helpers/database.ts`   | `resetDatabase()` and the `db` handle for assertions                                                                                                       |

```ts
const api = requester(handler);

it("renames the club", async () => {
  const alice = await signIn("alice");
  const club = await createClub({ members: [{ userId: alice.userId }] });

  const res = await api.put(`/api/club/${club.slug}/name`, { body: { name: "New" }, as: alice });

  expect(res.statusCode).toBe(200);
});
```

- **`as:` is a real session.** `signIn()` runs `auth.api.signUpEmail` + `signInEmail` and captures the signed cookie. Omit it for an anonymous request; pass `headers: { cookie: "better-auth.session_token=bogus" }` for an invalid one.
- **Assert through the API _and_ the database.** A write test should re-read via a GET or query `db` directly.
- **Seed with the factories, not the handlers** — arranging state through the code under test hides its bugs. The exception is when the setup _is_ the behaviour, e.g. adding a work twice to check the upsert.
- **`requestsTo(host)`** is how cache behaviour gets asserted: re-adding a known movie must make no second TMDB call.

Gotchas:

- Isolation is `resetDatabase()` between tests, deleting every domain table. The auth tables survive on purpose — signing a user up costs two bcrypt hashes, so the three fixture users are created once per file and reused, with `restoreFixtureUsers()` undoing profile edits.
- Files run serially (`fileParallelism: false`); they share one database. No `describe.concurrent`.
- **CockroachDB v25+ required.** On v24.1 the `20260407_ArbitraryClubLists` migration fails from scratch — the `DROP COLUMN` schema-change job is still in flight when the `DROP TYPE` runs. Override with `COCKROACH_TEST_IMAGE`.
- An error thrown inside a handler becomes a 500 (the router catches it). `executeTakeFirstOrThrow` on a missing row is the usual cause.
- kysely-codegen types bigint/numeric columns as `string` (`position: "1"`, `score: "8.5"`) — compare with `Number(...)`.

## Environment-dependent tests

To simulate a missing secret, use `vi.stubEnv(KEY, "")` rather than `vi.unstubAllEnvs()`. The latter passes locally but fails on Netlify, where the real secret is injected into the environment.

## Prefer a real dependency to a mocked one

A mocked repository can only confirm that the handler calls the function the test told it to expect. If a test needs a stub to be meaningful, that is usually a sign the thing under test should be exercised through its real collaborators instead. Mock at the boundary — the network — not between your own modules.
