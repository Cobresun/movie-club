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
    // Real router.push returns a Promise; code under test may chain .catch()
    push: vi.fn(() => Promise.resolve()),
  })),
}));

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
  render(PiniaStoreHelper);
});

afterEach(() => server.resetHandlers());

afterAll(() => server.close());
