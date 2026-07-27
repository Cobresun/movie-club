---
paths:
  - "**/*.spec.*"
  - "**/*.test.*"
  - "**/tests/**"
  - "src/mocks/**"
---

# Testing

Vitest with jsdom and `globals: true`, rooted at `src/`. Feature tests live in `src/features/<feature>/tests/`; render helpers in `src/tests/utils.ts`.

## What `src/tests/setup.ts` does for you

Read it before writing a test — it makes several things global, which explains behavior that otherwise looks like magic:

- **`vue-router` is mocked wholesale.** `useRoute()` always returns `params.clubSlug === "test-club"`, and `useRouter()` returns stubs. Don't set up a real router; do assert against those stubs for navigation.
- **A Pinia helper component is rendered before every test**, so stores are initialized without per-test setup.
- **`window.matchMedia` is stubbed** to always report `matches: false` — media-query-driven branches take the false path unless you override it.
- **MSW is started once and `resetHandlers()` runs after each test**, so per-test `server.use(...)` overrides don't leak.

API calls are mocked with MSW — handlers in `src/mocks/handlers.ts`, fixtures in `src/mocks/data/`. Unhandled requests only warn, so a request with no handler surfaces as a confusing empty/failed response rather than a clear error; add the handler.

## Environment-dependent tests

To simulate a missing secret, use `vi.stubEnv(KEY, "")` rather than `vi.unstubAllEnvs()`. The latter passes locally but fails on Netlify, where the real secret is injected into the environment.
