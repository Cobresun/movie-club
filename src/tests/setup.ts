import "@testing-library/jest-dom";
import PiniaStoreHelper from "./PiniaStoreHelper.test.vue";
import { render } from "./utils";
import { server } from "@/mocks/server";

vi.mock("vue-router", () => ({
  useRoute: vi.fn(() => ({
    params: {
      clubSlug: "test-club",
    },
  })),
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    // `useBackButtonClose` registers a navigation guard; return an unregister fn.
    beforeEach: vi.fn(() => vi.fn()),
  })),
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
  server.listen();
});

beforeEach(() => {
  render(PiniaStoreHelper);
});

afterEach(() => server.resetHandlers());

afterAll(() => server.close());
