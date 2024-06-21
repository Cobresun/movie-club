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

beforeAll(() => {
  server.listen();
});

beforeEach(() => {
  render(PiniaStoreHelper);
});

afterEach(() => server.resetHandlers());

afterAll(() => server.close());
