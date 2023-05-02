import "@testing-library/jest-dom";
import { server } from "@/mocks/server";

vi.mock("vue-router", () => ({
  useRoute: vi.fn(() => ({
    params: {
      clubId: 1,
    },
  })),
  useRouter: vi.fn(() => ({
    push: vi.fn(),
  })),
}));

beforeAll(() => server.listen());

afterEach(() => server.resetHandlers());

afterAll(() => server.close());
