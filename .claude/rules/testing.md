---
paths:
  - "**/*.spec.*"
  - "**/*.test.*"
  - "**/tests/**"
  - "src/mocks/**"
---

# Testing

Three Vitest projects, all run by `npm test`:

- **client**: jsdom, `src/**`. Feature tests in `src/features/<feature>/tests/`, helpers in `src/tests/utils.ts`.
- **server**: node, `lib/**` and `netlify/functions/utils/**`. Pure functions, no database.
- **integration**: node, `netlify/functions/tests/**`. Every handler against a real CockroachDB (needs Docker).

## What a test may assert on

- **The result, never the request.** Don't capture an outgoing call and check its URL or body. Assert on what was returned or what is on screen. For an optimistic write that refetches, use a stateful fake (`commentsApi()`, `clubListsApi()` in `src/mocks/`).
- **Query the way a user finds things**: `getByRole`, `getByLabelText`, `getByText`. Never `querySelector`, a class, `getByTitle` or `data-testid`. A modal or sheet is `getByRole("dialog", { name })`.
- **If an element can't be found without a selector, fix the component.** It has no role or accessible name, so a screen reader can't reach it either.
- **Not styling.** No assertions on classes, colours or sizes.
- **Read the clipboard, never spy on it**: `await navigator.clipboard.readText()`. `render()` installs a working clipboard, which also replaces any spy set up in `beforeEach`.
- **No casts** (`as never`, `as unknown as T`, `!`). Use the shared stub for a browser API, narrow a helper's parameter type so a plain object fits, keep fixtures as typed modules in `src/mocks/data/`, and delete a test for a state the types forbid.

## What is worth testing

- Not constants, registry shape, or pass-through components. Test the behaviour they drive, through the view.
- Service hooks and composables are covered through the components that use them. What's left (an error path, timing) goes in a spec that calls the composable through `withSetup()` from `@/tests/utils`.
- **Fix the harness, not the spec.** A missing global goes in `src/tests/utils.ts`; a signed-in user is `logIn(pinia)`. No stubbed components, re-mocked router or hand-built `defineComponent` wrapper.
- **Mock at the network, not between our own modules.** No `vi.mock` of `@/lib/auth-client`, `axios` or a repository. Answer `/api/auth/get-session` and external APIs with MSW.

## What `src/tests/setup.ts` already does

- **`vue-router` is mocked** with one shared route (`params.clubSlug === "test-club"`, empty `query`) and router, reset per test. Mutate `useRoute().query` for other inputs; assert navigation with `vi.mocked(useRouter()).push`. Never re-mock it.
- **`router-link` is a plain anchor.** Query with `getByRole("link", { name })`.
- **`matchMedia` reports mobile.** Call `setViewport(true)` from `@/tests/utils` before `render` for desktop.
- **MSW runs with `onUnhandledRequest: "error"`** and resets handlers per test. A missing handler shows up as a ~1s `waitFor` timeout. Add one with `server.use(…)` in the test; don't edit shared handlers for one case. Handlers name the contract type (`HttpResponse.json<ClubPreview>(club)`).
- TanStack Query retries a failed query three times, so error paths need an explicit 500 handler.
- **`createTestingPinia()` stubs every action to return `undefined`.** A component chaining `.then` on one crashes unless the test sets `mockResolvedValue`. `logIn(pinia)` does this for `refreshSession`.

## Client gotchas

- **`IntersectionObserver`**: call `mockIntersectionObserver()` (`@/mocks/IntersectionObserver`) in any spec rendering `v-lazy-load` or `v-reveal`, or the mount throws and later tests fail confusingly. Pass `{ intersecting: true }` to assert a resolved `src`.
- **AG Charts**: `vi.mock("ag-charts-vue3", async () => await import("@/mocks/agCharts"))`. The dynamic import avoids a hoisting TDZ error. Detailed option assertions go in `chartOptions.spec.ts`.
- **Card images and downloads**: mock `modern-screenshot` the same way (`@/mocks/modernScreenshot`), then call `mockCanvas()` and `mockDownloads()` before saving. Assert on the toast.
- **`GalleryView`**: render `ReviewView`, which supplies its filtered reviews and members, rather than a hand-picked list.
- **Statistics**: fixtures are in `src/features/statistics/tests/fixtures.ts`. Trend and spread charts need six scored reviews, and `computeScoreTrend` reads `work.scores`, not `work.userScores`.
- **Missing secret**: `vi.stubEnv(KEY, "")`, not `vi.unstubAllEnvs()`, which fails on Netlify where the real secret is injected.
- **Timezone** is pinned to UTC; write date assertions against UTC.

## Integration tests (`netlify/functions/tests/`)

Arrange and assert through the interfaces a client has. Routers, middleware, BetterAuth, repositories and the schema are real. Only TMDB, Google Books, Gemini, Resend and Cloudinary are faked, with MSW.

- **No `vi.mock` of repositories, `utils/database`, `utils/auth` or `utils/session`, and no direct database reads or seeds.** `helpers/database.ts` exports only `resetDatabase()`.
- Use the helpers: `requester(handler)` (`helpers/http.ts`), `signIn("alice")` for a real session cookie (`helpers/auth.ts`), and the factories (`createClub`, `addWork`, `scoreWork`), which drive real endpoints.
- **Assert a write by reading it back** through the endpoint a client would use.
- **`failOnRequest(method, path)`** asserts "must not call out again" by making that request throw.
- The only database exceptions are `expireInvite()` and `scheduled-db-cleanup.test.ts`, each commented where it lives.

```ts
const api = requester(handler);
const alice = await signIn("alice");
const club = await createClub(alice);

const res = await api.put(`/api/club/${club.slug}/name`, { body: { name: "New" }, as: alice });

expect(res.statusCode).toBe(200);
expect((await api.get<ClubPreview>(`/api/club/${club.slug}`)).body.clubName).toBe("New");
```

Gotchas:

- `setup/env.ts` must be imported before anything that reaches `utils/database.ts`, which builds its pool at import.
- Files run serially against one database. No `describe.concurrent`.
- `resetDatabase()` clears domain tables between tests; a new table fails type-check there until it is listed. Auth tables survive and fixture users are reused.
- CockroachDB v25+ is required (`COCKROACH_TEST_IMAGE` overrides).
- An unexpected 500 is usually `executeTakeFirstOrThrow` on a missing row.
- `MovieDataSummary` has no `title`, `overview` or `tagline`. Assert on `runtime` or `status`, or read the per-work details endpoint.
