import "@testing-library/jest-dom";
import PiniaStoreHelper from "./PiniaStoreHelper.test.vue";
import { render } from "./utils";
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
}));

vi.mock("vue-router", () => ({
  useRoute: vi.fn(() => route),
  useRouter: vi.fn(() => router),
}));

// jsdom doesn't implement scrollIntoView; the gallery's card-click handler calls
// it when opening the details drawer.
window.HTMLElement.prototype.scrollIntoView = vi.fn();

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});

beforeEach(() => {
  router.push.mockClear();
  router.replace.mockClear();
  route.params = { clubSlug: "test-club" };
  route.query = {};
  render(PiniaStoreHelper);
});

afterEach(() => server.resetHandlers());

afterAll(() => server.close());
