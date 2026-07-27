---
paths:
  - "**/*.spec.*"
  - "**/*.test.*"
  - "**/tests/**"
  - "src/mocks/**"
---

# Testing

## Vitest projects

Vitest is split into two projects in `vite.config.ts`:

- **client** — jsdom environment, runs `src/**/*.{test,spec}.ts`, setup file `src/tests/setup.ts`
- **server** — node environment, runs `lib/**/*.{test,spec}.ts` and `netlify/functions/**/*.{test,spec}.ts` (no setup file, no MSW)

Run one project with `npx vitest run --project client <path>` / `--project server`. `npm test` runs both.

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

## Server (backend) tests

- **Location:** handler/route tests in `netlify/functions/tests/`, util tests in `netlify/functions/utils/tests/`, service tests in `netlify/functions/services/tests/`, `lib/checks` tests in `lib/checks/tests/`.
- **Helpers:** `netlify/functions/tests/helpers.ts` provides `makeEvent()`, `stubContext`, `assertResponse()` (narrows the handler's `void | HandlerResponse`), and `parseBody<T>()`.
- **Mock everything external:** `vi.mock` every repository module, `../utils/database`, and `../utils/auth` (BetterAuth instantiates at import time and reads env vars — it must be mocked before importing any handler). Vitest hoists `vi.mock` above imports, so keep all imports at the top (oxlint import order) with the mock blocks after them.
- **Generated-type gotchas:** kysely-codegen represents bigint/numeric columns as `string` (`position: "1"`, `runtime: "148"`); club rows require `legacy_id` and `slug_updated_at`; `WorkType` / `WorkListSystemType` are enums from `lib/types/generated/db` — never use string literals for them. Mock kysely results with real `InsertResult` / `UpdateResult` / `DeleteResult` instances, not `undefined`.
- **Repositories are not unit-tested:** they are thin Kysely query builders, covered by integration via deploy-preview databases.

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
