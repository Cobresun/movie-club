import "@testing-library/jest-dom";
import PiniaStoreHelper from "./PiniaStoreHelper.test.vue";
import { render, setViewport } from "./utils";
import { server } from "@/mocks/server";

// One router instance for the whole suite, so a test can assert navigation with
// `useRouter().push` instead of re-mocking `vue-router` for itself.
const router = vi.hoisted(() => ({
  // Real router.push returns a Promise; code under test may chain .catch()
  push: vi.fn(() => Promise.resolve()),
  replace: vi.fn(() => Promise.resolve()),
  // `useBackButtonClose` registers a navigation guard; return an unregister fn.
  beforeEach: vi.fn(() => vi.fn()),
}));

// Likewise one route object: a test that needs a query param or a different
// slug mutates `useRoute()` rather than re-mocking `vue-router` for itself.
const route = vi.hoisted(() => ({
  params: { clubSlug: "test-club" } as Record<string, string>,
  query: {} as Record<string, string>,
  // Components that resolve the active club section read `matched` (see
  // clubSections.sectionNameForRoute); a spec sets it to name the section.
  matched: [] as { name?: string }[],
}));

vi.mock("vue-router", () => ({
  useRoute: vi.fn(() => route),
  useRouter: vi.fn(() => router),
}));

// jsdom doesn't implement scrollIntoView; the gallery's card-click handler calls
// it when opening the details drawer.
window.HTMLElement.prototype.scrollIntoView = vi.fn();

// jsdom has no matchMedia; `useIsDesktop` calls it on mount. Tests default to
// mobile and opt into desktop with `setViewport(true)`.
Object.defineProperty(window, "matchMedia", { writable: true, value: vi.fn() });

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});

beforeEach(() => {
  setViewport(false);
  router.push.mockClear();
  router.replace.mockClear();
  route.params = { clubSlug: "test-club" };
  route.query = {};
  route.matched = [];
  render(PiniaStoreHelper);
});

afterEach(() => server.resetHandlers());

afterAll(() => server.close());
