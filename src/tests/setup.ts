import "@testing-library/jest-dom";
import PiniaStoreHelper from "./PiniaStoreHelper.test.vue";
import { render } from "./utils";

import { server } from "@/mocks/server";

vi.mock("vue-router", () => ({
  useRoute: vi.fn(() => ({
    params: {
      clubId: "1",
    },
  })),
  useRouter: vi.fn(() => ({
    push: vi.fn(),
  })),
}));

// Mock vue3-emoji-picker to avoid IndexedDB issues in tests
vi.mock("vue3-emoji-picker", () => ({
  default: {
    name: "EmojiPicker",
    template: "<div data-testid='emoji-picker-mock'>Emoji Picker Mock</div>",
    emits: ["select"],
  },
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
  server.listen();
});

beforeEach(() => {
  render(PiniaStoreHelper);
});

afterEach(() => server.resetHandlers());

afterAll(() => server.close());
