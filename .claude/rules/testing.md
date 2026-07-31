---
paths:
  - "**/*.spec.*"
  - "**/*.test.*"
  - "**/tests/**"
  - "src/mocks/**"
---

# Testing

## Vitest projects

Vitest is split into three projects in `vite.config.ts`:

- **client** — jsdom environment, runs `src/**/*.{test,spec}.ts`, setup file `src/tests/setup.ts`
- **server** — node environment, runs `lib/**/*.{test,spec}.ts` and `netlify/functions/utils/**/*.{test,spec}.ts` (pure units: no database, no setup file)
- **integration** — node environment, runs `netlify/functions/tests/**/*.{test,spec}.ts` against a real CockroachDB in Docker

Run one project with `npx vitest run --project client <path>` / `--project server` / `--project integration`. `npm test` runs all three.

**The integration project needs Docker running.** Without it, `npm test` fails in `globalSetup` before any test executes.

## Client (frontend) tests

- **Render helper:** always use `render()` from `src/tests/utils.ts` — it installs VueQueryPlugin, `createTestingPinia()`, mdi icons, Toast, the `v-lazy-load` directive, and global component aliases (`v-btn`, `v-modal`, `movie-table`, `page-header`, `v-avatar`, `loading-spinner`), and returns `{ user, pinia }` alongside testing-library queries.
- **Global mocks** (in `src/tests/setup.ts`): `vue-router` is module-mocked — `useRoute()` returns `params.clubSlug = "test-club"` and `useRouter().push` returns a resolved Promise. `window.matchMedia` is stubbed.
- **MSW is strict:** `onUnhandledRequest: "error"`. Any HTTP request without a handler fails the test (symptom: ~1s `waitFor` timeout). Baseline handlers live in `src/mocks/handlers.ts`; add per-test handlers inside the test with `server.use(...)` via `import { server } from "@/mocks/server"` — never edit the shared handler/setup files for one test. Error-path tests need an explicit error handler (e.g. a 500 response); note TanStack Query retries failed queries 3× by default.
- **Testing-pinia gotcha:** `createTestingPinia()` stubs every store action to a no-op spy returning `undefined`. A component that chains `.then/.catch` on an action (e.g. `auth.refreshSession().catch(...)`) crashes unless the test does `vi.mocked(store.action).mockResolvedValue(undefined)` before interacting. Never assert on state an action stub was supposed to change — it changes nothing.
- **Test location:** feature tests in `src/features/<feature>/tests/`, shared component/composable tests in `src/common/tests/`, service tests in `src/service/tests/`.
- **`IntersectionObserver`:** jsdom has none, and `v-lazy-load` / `v-reveal` construct one on mount — call `mockIntersectionObserver()` (`@/mocks/IntersectionObserver`) at the top of any spec rendering them, or the mount throws and later tests in the file fail with confusing leftover-DOM errors. It defaults to never firing, which leaves a lazy image's real URL parked in `data-src` with an empty `src`; pass `{ intersecting: true }` when a test needs to assert the resolved `src`.
- **AG Charts:** the real component paints into a `<canvas>` jsdom cannot provide and throws on both mount and unmount. Spec files rendering a chart widget opt into the stub with `vi.mock("ag-charts-vue3", async () => await import("@/mocks/agCharts"))` — the dynamic import avoids the TDZ error a statically-imported stub would hit under `vi.mock` hoisting. The stub renders `role="img"` / `aria-label="chart"`, and exposes `chartOptions(el)` / `chartSeriesNames(el)` for asserting that a mode switch reconfigured the chart. Detailed option assertions belong in `chartOptions.spec.ts`, not in widget specs.
- **Clipboard:** `userEvent.setup()` — which `render()` calls every time — installs its own `navigator.clipboard`. A clipboard spy stubbed in `beforeEach` is silently replaced before the component runs, and the test fails with "0 calls" even though the copy succeeded. Spy on `navigator.clipboard` _after_ `render()`.
- **Statistics fixtures:** `src/features/statistics/tests/fixtures.ts` holds the `WorkStatsData` / `Member` factories. Two thresholds bite: `computeScoreTrend` reads `work.scores` (timestamped records), not `work.userScores`, and both rolling charts use a window of `Math.max(5, …)` — so trend/spread need six scored reviews before they plot anything.
- **Review table components:** `GalleryView` / `TableView` take a live TanStack table. `src/features/reviews/tests/reviewTable.ts` provides `withReviewTable()`, which wraps the component in a host that builds one (`useVueTable` needs a component instance, so a table cannot be built in module scope).

## Server (unit) tests

Pure functions with no database: `lib/checks`, `lib/googleBooks`, and everything under `netlify/functions/utils/` (router, responses, slug, validation, tmdb, gemini, email, providers, movieDetailsUpdater). These may `vi.mock` external transports (axios, Resend) because there is nothing else to reach.

Anything that touches a repository, the database, or auth belongs in the integration project instead.

## Integration (backend) tests

`netlify/functions/tests/` runs the handlers end to end. **Do not `vi.mock` repositories, `utils/database`, or `utils/auth` here** — mocking those was what the suite used to do, and it hid a live 404 on every awards write route because the mocks answered a URL shape the real router never matched.

**What is real:** the routers, `validClubSlug` / `validListId`, BetterAuth's `loggedIn` / `secured`, every repository, Kysely, and a CockroachDB started by testcontainers.

**What is faked:** the third-party HTTP APIs, and only at the network boundary (MSW) — TMDB, Google Books, Gemini, Resend, Cloudinary. `onUnhandledRequest: "error"`, so a call to any other host fails the test.

### Layout

| Path                    | Purpose                                                                                                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `setup/globalSetup.ts`  | Starts the container once per run and migrates it via `npx tsx ./migrations/schemaMigrator.ts`                                                                            |
| `setup/env.ts`          | Points `DATABASE_URL` / `DATABASE_URL_ROOT` at the container. **Must be imported before anything that reaches `utils/database.ts`**, which builds its pool at import time |
| `setup/integration.ts`  | Per-file setup: starts MSW, resets the database before each test                                                                                                          |
| `setup/externalApis.ts` | The MSW server, its default handlers, and `requestsTo(host)`                                                                                                              |
| `fixtures/external.ts`  | `tmdbMovie()` / `googleBooksVolume()` / `geminiJsonResponse()` payload builders                                                                                           |
| `helpers/http.ts`       | `requester(handler)` → `.get/.post/.put/.delete`, plus `makeEvent()` / `send()` for hand-rolled events                                                                    |
| `helpers/auth.ts`       | `signIn("alice" \| "bob" \| "carol")` → a real signed session cookie                                                                                                      |
| `helpers/factories.ts`  | Row seeding: `createClub`, `createWork`, `addToList`, `createReview`, …                                                                                                   |
| `helpers/database.ts`   | `resetDatabase()` and the `db` handle for assertions                                                                                                                      |

### Writing one

```ts
const api = requester(handler);

it("renames the club", async () => {
  const alice = await signIn("alice");
  const club = await createClub({ members: [{ userId: alice.userId }] });

  const res = await api.put(`/api/club/${club.slug}/name`, { body: { name: "New" }, as: alice });

  expect(res.statusCode).toBe(200);
});
```

- **`as:` is a real session.** `signIn()` runs `auth.api.signUpEmail` + `signInEmail` and captures the signed cookie, so `secured` verifies it against real `session` rows. Omit `as` for an anonymous request; pass `headers: { cookie: "better-auth.session_token=bogus" }` for an invalid one.
- **Assert through the API, then through the database.** A write test should re-read via a GET (proving the round trip) or query `db` directly (proving the row).
- **Seed with the factories, not the handlers.** Arranging state through the code under test hides its bugs. The exception is when the setup _is_ the behaviour, e.g. adding a work twice to check the upsert.
- **Cache assertions use `requestsTo(host)`** — e.g. re-adding a known movie must make no second TMDB call.

### Gotchas

- **Isolation is `resetDatabase()` between tests**, which deletes every domain table. The auth tables (`user`, `account`, `session`, `verification`) survive on purpose: signing a user up costs two bcrypt hashes, so the three fixture users are created once per file and reused. `restoreFixtureUsers()` undoes profile edits so a rename cannot leak into the next test.
- **Files run serially** (`fileParallelism: false`) — they share one database. Do not add `describe.concurrent`.
- **CockroachDB v25+ is required.** On v24.1 the `20260407_ArbitraryClubLists` migration fails from scratch: the `DROP COLUMN` schema-change job is still in flight when the `DROP TYPE` runs. Override the image with `COCKROACH_TEST_IMAGE`.
- **Errors thrown inside a handler become a 500** (the router catches and logs). `executeTakeFirstOrThrow` on a missing row is the usual cause — see the cross-club review test.
- **Generated-type gotchas:** kysely-codegen represents bigint/numeric columns as `string` (`position: "1"`, `score: "8.5"`), so compare with `Number(...)`. `WorkType` / `WorkListSystemType` / `ClubType` are enums from `lib/types/generated/db` — never string literals.

## Conventions

- No `as` casts (see code-quality rules). For un-narrowable wide unions (e.g. ag-charts options), use runtime type-predicate helpers — see the top of `src/features/statistics/tests/scoring.test.ts`.
- Query the DOM by role/text/aria-label, not CSS selectors. No snapshot tests.
- `oxlint.config.ts` has an `overrides` entry turning off `typescript/unbound-method` for `*.test.ts`/`*.spec.ts` only — `expect(Repo.method)` / `vi.mocked(Repo.method)` trip it on every assertion against a mocked module.
- **Coverage:** `npm run coverage`; spans `src/`, `lib/`, and `netlify/functions/` with thresholds in `vite.config.ts` that must not be lowered. Per-file numbers: `npx vitest run <path> --coverage.enabled=true --coverage.all=false`.

## Writing good tests (review checklist)

A test that runs green is not automatically a good test — especially one written by an AI. Before keeping a generated test, check it against these (adapted from Vitest's [Writing tests with AI](https://vitest.dev/guide/learn/writing-tests-with-ai.html)):

- **Assert real behaviour, not existence.** `expect(x).toBeDefined()` or "it didn't throw" prove almost nothing. Assert the actual rendered text, `href`, `src`, class, emitted event, or return value — see `CastAvatar.spec.ts` (checks the exact TMDB `src` and the `opacity-0` fade class) and `WatchProviders.spec.ts` (asserts the exact ordered provider list).
- **Test behaviour, not implementation.** A test that mocks every dependency and asserts internal call order breaks on every refactor while catching no bugs. Prefer driving the component through `user` events and asserting what the user sees. Mock only at the boundary (network via MSW, not internal functions). If you find yourself spying on a component's own methods, reconsider.
- **Cover the edge cases the happy path hides.** Empty collections, missing/`null` props, the "+N more" boundary, and error responses. Strict MSW already forces you to think about the network path; add an explicit error handler (500) for failure cases rather than leaving the request unmocked. Good models: `CastList.spec.ts` (0 / ≤5 / >5 cast) and `ExternalLink.spec.ts` (renders nothing with no `href`).
- **Query like a user.** Role/text/label, never CSS selectors or test-ids (already a convention above). This keeps tests resilient to markup changes and accessible by construction.
- **Keep names concise and behavioural.** "renders nothing when there is no cast" beats "test CastList component empty state rendering behavior".
- **Mocks reset every test.** `restoreMocks: true` (in `vite.config.ts`) restores all spies/mocks after each test — set `mockResolvedValue`/`mockReturnValue` inside the test or a `beforeEach`, never rely on state from a previous test. (See the testing-pinia gotcha above.)
- **Run it, then try to break it.** `npx vitest run <path>` immediately, then flip the assertion or the source to confirm the test actually fails when it should. A test that passes against broken code is worse than no test.
- **Prefer a real dependency to a mocked one.** The backend suite mocks nothing but the third-party HTTP APIs; a mocked repository can only ever confirm that the handler calls the function the test told it to expect. If a test needs a stub to be meaningful, that is usually a sign the thing under test should be exercised through its real collaborators instead.
