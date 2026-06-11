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

## Server (backend) tests

- **Location:** handler/route tests in `netlify/functions/tests/`, util tests in `netlify/functions/utils/tests/`, service tests in `netlify/functions/services/tests/`, `lib/checks` tests in `lib/checks/tests/`.
- **Helpers:** `netlify/functions/tests/helpers.ts` provides `makeEvent()`, `stubContext`, `assertResponse()` (narrows the handler's `void | HandlerResponse`), and `parseBody<T>()`.
- **Mock everything external:** `vi.mock` every repository module, `../utils/database`, and `../utils/auth` (BetterAuth instantiates at import time and reads env vars — it must be mocked before importing any handler). Vitest hoists `vi.mock` above imports, so keep all imports at the top (ESLint import order) with the mock blocks after them.
- **Generated-type gotchas:** kysely-codegen represents bigint/numeric columns as `string` (`position: "1"`, `runtime: "148"`); club rows require `legacy_id` and `slug_updated_at`; `WorkType` / `WorkListSystemType` are enums from `lib/types/generated/db` — never use string literals for them. Mock kysely results with real `InsertResult` / `UpdateResult` / `DeleteResult` instances, not `undefined`.
- **Repositories are not unit-tested:** they are thin Kysely query builders, covered by integration via deploy-preview databases.

## Conventions

- No `as` casts (see code-quality rules). For un-narrowable wide unions (e.g. ag-charts options), use runtime type-predicate helpers — see the top of `src/features/statistics/tests/scoring.test.ts`.
- Query the DOM by role/text/aria-label, not CSS selectors. No snapshot tests.
- ESLint disables `unbound-method`, `require-await`, and `vue/one-component-per-file` for `*.test.ts`/`*.spec.ts` only (they false-positive on Vitest idioms).
- **Coverage:** `npm run coverage`; spans `src/`, `lib/`, and `netlify/functions/` with thresholds in `vite.config.ts` that must not be lowered. Per-file numbers: `npx vitest run <path> --coverage.enabled=true --coverage.all=false`.
