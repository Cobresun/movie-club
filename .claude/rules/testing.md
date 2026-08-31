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

## What a test is allowed to assert on

These four come up in review more than anything else. They apply to every project, not just the client.

**Assert on the result, never on the request.** Capturing an outgoing call and checking its URL or body proves the code called the function the test told it to expect. It passes just as happily when the endpoint is wrong in a way the test also got wrong. Assert on what the function returned, or on what is now on screen.

```ts
// No — the test and the code agree with each other, not with the API.
let body: unknown;
server.use(http.post("/api/club/:id/list", async ({ request }) => { body = await request.json(); … }));
expect(body).toMatchObject({ title: "Sci-Fi" });

// Yes — the list is there afterwards.
await user.click(screen.getByRole("button", { name: "+ Create" }));
expect(await screen.findByText("Sci-Fi")).toBeInTheDocument();
```

When the write is optimistic and refetches, that needs a handler that remembers: `commentsApi()` (`src/mocks/comments.ts`) and `clubListsApi()` (`src/mocks/lists.ts`) are fakes that keep what the mutations send them, so the round trip is real. Write one rather than freezing a single canned response.

**Query the way a user finds things.** `getByRole`, `getByLabelText`, `getByText`. Never `container.querySelector`, a class, or `getByTitle` — a `title` attribute is a tooltip, not a name.

**A test that cannot find an element without a selector has found a bug.** That is the point of the rule: an element with no role and no accessible name is one a screen reader cannot announce and a keyboard cannot reach. Fix the component — add the role, the `aria-label`, the `aria-pressed`, or make the `<div @click>` a real `<button>` — then query it. This has turned up a keyboard-unreachable poster card, unnamed icon buttons, a filter chip whose selected state was colour alone, and a spoiler that screen readers read out in full. Do not add a test-only hook such as `data-testid` to get around it.

**Do not assert on styling.** Class names, colours, paddings and font sizes should be free to change without a test failing. If a class is the only evidence of a state, that state has no accessible representation — see the rule above.

## What is worth testing at all

- **Constants.** A test that restates a constant only forces two edits instead of one. Test the function that reads it.
- **Configuration.** Registry shape — key uniqueness, what `props()` returns — is the same thing one level up. Assert the behaviour it drives, through the view that renders it.
- **Plumbing.** A component that only passes props down and re-emits events up is covered by its child's spec and its parent's.
- **Service hooks.** Same answer as composables, and stated more bluntly in review: a spec that mounts a harness around `useList` and asserts that an API call happened is testing the harness. The logic in `src/service/use<Feature>.ts` belongs to the components that consume it — cover it there. What is genuinely left over goes in `src/service/tests/`.
- **Composables.** Logic in a composable is usually covered by the components that use it — cover it there first. What is left over (branches no component reaches, timing, an error path) belongs in a spec that calls the composable directly through `withSetup()` from `@/tests/utils`; never build a `defineComponent` harness by hand.

**Fix the harness, don't work around it in the spec.** If `render()` is missing a global registration, add it to `src/tests/utils.ts`; if several specs need a signed-in user, use `logIn(pinia)` rather than a fourth hand-rolled variant. Stubbing a component, re-mocking the router, or building a bespoke `defineComponent` wrapper to get one spec green leaves the next author with the same problem — and hand-rolled harnesses get sent back in review.

## What `src/tests/setup.ts` does for you

Read it before writing a test — it makes several things global, which explains behavior that otherwise looks like magic:

- **`vue-router` is mocked wholesale**, with one shared route and one shared router for the whole suite, both reset before every test. `useRoute()` returns `params.clubSlug === "test-club"` and an empty `query` — mutate it (`useRoute().query.token = "…"`) when a view reads something else. `useRouter()` returns stable `push`/`replace` spies, so assert navigation with `vi.mocked(useRouter()).push.mock.calls`. Never re-mock `vue-router` in a spec.
- **`router-link` is stubbed as a plain anchor**, so links keep their slot content and carry `role="link"`. Query navigation with `getByRole("link", { name })` rather than reaching for `router-link-stub`.
- **A Pinia helper component is rendered before every test**, so stores are initialized without per-test setup.
- **`window.matchMedia` is stubbed** to always report `matches: false` — media-query-driven branches take the false path unless you override it.
- **MSW is started once and `resetHandlers()` runs after each test**, so per-test `server.use(...)` overrides don't leak.

API calls are mocked with MSW — handlers in `src/mocks/handlers.ts`, fixtures in `src/mocks/data/`. **`onUnhandledRequest: "error"`**: a request with no handler fails the test, usually surfacing as a ~1s `waitFor` timeout. Add the handler with `server.use(...)` inside the test; never edit the shared handler file for one case. Error paths need an explicit 500 handler, and TanStack Query retries a failed query 3× by default.

`createTestingPinia()` stubs every store action to a no-op spy returning `undefined`. A component chaining `.then/.catch` on one (`auth.refreshSession().catch(...)`) crashes unless the test does `vi.mocked(store.action).mockResolvedValue(undefined)` first — and state an action stub was supposed to change never changes. `logIn(pinia)` already does this for `refreshSession`.

## Client gotchas that cost an hour each

- **`IntersectionObserver`** doesn't exist in jsdom, and `v-lazy-load` / `v-reveal` construct one on mount. Call `mockIntersectionObserver()` (`@/mocks/IntersectionObserver`) at the top of any spec rendering them or the mount throws and later tests fail with confusing leftover-DOM errors. It defaults to never firing, which parks a lazy image's URL in `data-src` with an empty `src`; pass `{ intersecting: true }` to assert the resolved `src`.
- **AG Charts** paints into a `<canvas>` jsdom cannot provide and throws on both mount and unmount. Opt into the stub with `vi.mock("ag-charts-vue3", async () => await import("@/mocks/agCharts"))` — the dynamic import avoids the TDZ error a static one hits under `vi.mock` hoisting. It renders `role="img"` and exposes `chartOptions(el)` / `chartSeriesNames(el)`; detailed option assertions belong in `chartOptions.spec.ts`.
- **Clipboard:** `userEvent.setup()` — which `render()` always calls — installs the `navigator.clipboard` jsdom lacks, and it is a working one. Assert with `await navigator.clipboard.readText()`, the way a user would paste. Stubbing a `writeText` spy in `beforeEach` fails with "0 calls" while a success toast proves the copy happened, because `setup()` replaced the object the spy was on.
- **`GalleryView`** takes a live TanStack table built by `ReviewView`, and `useVueTable` needs a component instance, so one cannot be built in module scope. Render `ReviewView` rather than constructing a stand-in table: a hand-built one sorts perfectly while the real columns are wrong.
- **Statistics fixtures** live in `src/features/statistics/tests/fixtures.ts`. Two thresholds bite: `computeScoreTrend` reads `work.scores` (timestamped), not `work.userScores`, and both rolling charts use a window of `Math.max(5, …)` — so trend/spread need six scored reviews before they plot anything.

## Integration tests (`netlify/functions/tests/`)

**Arrange and assert through the same interfaces a client has.** No `vi.mock` of repositories, `utils/database` or `utils/auth`, and no direct database reads — a test that queries a table is asserting an implementation detail, and one that seeds a table is describing a state the app may not even be able to produce. `helpers/database.ts` deliberately does not export the Kysely handle.

Real: the routers, `validClubSlug` / `validListId`, BetterAuth's `loggedIn` / `secured`, every repository, Kysely, the migrated schema. Faked, and only at the network boundary via MSW: TMDB, Google Books, Gemini, Resend, Cloudinary — with `onUnhandledRequest: "error"`, so a call to any other host fails the test.

| Path                    | Purpose                                                                                                                                                    |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `setup/globalSetup.ts`  | Starts the container once per run, migrates it via `npx tsx ./migrations/schemaMigrator.ts`                                                                |
| `setup/env.ts`          | Points `DATABASE_URL` / `DATABASE_URL_ROOT` at it. **Must be imported before anything reaching `utils/database.ts`**, which builds its pool at import time |
| `setup/integration.ts`  | Per-file setup: starts MSW, resets the database before each test, undoes profile edits after                                                               |
| `setup/externalApis.ts` | The MSW server, its handlers, `failOnRequest()` and `sentEmails`                                                                                           |
| `fixtures/external.ts`  | `tmdbMovie()` / `googleBooksVolume()` / `geminiJsonResponse()` payload builders                                                                            |
| `helpers/http.ts`       | `requester(handler)` → `.get/.post/.put/.delete`, plus `makeEvent()` / `send()`                                                                            |
| `helpers/auth.ts`       | `signIn("alice" \| "bob" \| …)` → a real signed session cookie                                                                                             |
| `helpers/factories.ts`  | `createClub`, `addWork`, `scoreWork`, `addComment`, … — all driving real endpoints                                                                         |
| `helpers/database.ts`   | `resetDatabase()` only                                                                                                                                     |

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
- **`failOnRequest(method, path)`** is how "must not call out again" gets asserted: it swaps that endpoint's handler for one that throws, so caching is proved by the request never happening rather than by counting requests.

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

**Auth is not an exception.** Don't `vi.mock("@/lib/auth-client")` — drive the session over the network like everything else, answering `/api/auth/get-session` with MSW. (`auth-client.ts` resolves `fetch` per call rather than capturing it at module load precisely so MSW can intercept; that indirection is load-bearing, not an oversight.) On the backend the same rule rules out mocking `axios`: TMDB, Google Books, Gemini and Resend are faked at their URLs, with the real HTTP client underneath.

A mocked repository can only confirm that the handler calls the function the test told it to expect. If a test needs a stub to be meaningful, that is usually a sign the thing under test should be exercised through its real collaborators instead. Mock at the boundary — the network — not between your own modules.
