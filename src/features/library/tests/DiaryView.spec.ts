import { screen } from "@testing-library/vue";

import DiaryView from "../views/DiaryView.vue";

import { mockIntersectionObserver } from "@/mocks/IntersectionObserver";
import { render } from "@/tests/utils";

mockIntersectionObserver();

// A real-ish route we can mutate per test (the global setup mock has no
// `query`, which the ?type= filter reads). useRouter keeps the `beforeEach`
// stub `useBackButtonClose` needs for the log-watch modal's overlay.
const { route, push } = vi.hoisted(() => {
  const route: {
    params: Record<string, string>;
    query: Record<string, string>;
  } = { params: {}, query: {} };
  const push = vi.fn(() => Promise.resolve());
  return { route, push };
});

vi.mock("vue-router", () => ({
  useRoute: () => route,
  useRouter: () => ({ push, beforeEach: vi.fn(() => vi.fn()) }),
}));

describe("DiaryView", () => {
  afterEach(() => {
    route.query = {};
  });

  it("renders the diary stream with context chips", async () => {
    render(DiaryView);

    expect(await screen.findByText("Inception")).toBeInTheDocument();
    expect(screen.getByText("12 Angry Men")).toBeInTheDocument();
    expect(screen.getByText("Dune")).toBeInTheDocument();

    // Two solo events → two "My Library" chips; one club event → its name.
    expect(screen.getAllByText("My Library")).toHaveLength(2);
    expect(screen.getByText("Test Club")).toBeInTheDocument();
  });

  it("marks written reviews and rewatches only where present", async () => {
    render(DiaryView);
    await screen.findByText("Inception");

    // Only the solo Inception event has text and is a rewatch.
    expect(screen.getAllByTitle("Has a written review")).toHaveLength(1);
    expect(screen.getAllByTitle("Rewatch")).toHaveLength(1);
  });

  it("narrows the stream by the ?type= filter", async () => {
    route.query = { type: "movie" };
    render(DiaryView);

    // Movies stay; the book (Dune) is filtered out.
    expect(await screen.findByText("Inception")).toBeInTheDocument();
    expect(screen.getByText("12 Angry Men")).toBeInTheDocument();
    expect(screen.queryByText("Dune")).not.toBeInTheDocument();
  });
});
