import { screen, waitFor } from "@testing-library/vue";
import { http, HttpResponse } from "msw";

import StatisticsView from "../views/StatisticsView.vue";
import { SCORED_MOVIE_REVIEW } from "./fixtures";
import { mockIntersectionObserver } from "@/mocks/IntersectionObserver";
import { server } from "@/mocks/server";
import { render } from "@/tests/utils";

vi.mock("ag-charts-vue3", async () => await import("@/mocks/agCharts"));

// setup.ts's global mock builds a fresh router per call, so the empty-state
// navigation test could never see the spy the component actually used.
const push = vi.fn(() => Promise.resolve());
vi.mock("vue-router", () => ({
  useRoute: vi.fn(() => ({ params: { clubSlug: "test-club" } })),
  useRouter: vi.fn(() => ({ push, beforeEach: vi.fn(() => vi.fn()) })),
}));

mockIntersectionObserver();

const noReviews = () => http.get("/api/club/:id/list/reviews", () => HttpResponse.json([]));

const scoredReviews = () =>
  http.get("/api/club/:id/list/reviews", () => HttpResponse.json([SCORED_MOVIE_REVIEW]));

const bookClub = () =>
  http.get("/api/club/:id", () =>
    HttpResponse.json({ clubId: 1, clubName: "Test club", type: "book" }),
  );

beforeEach(() => {
  push.mockClear();
});

describe("StatisticsView", () => {
  it("renders the statistics widgets once the club's reviews load", async () => {
    server.use(scoredReviews());
    render(StatisticsView);

    expect(await screen.findByText("movies watched")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Scores" })).toBeInTheDocument();
  });

  it("shows the page header while loading", () => {
    render(StatisticsView);

    expect(screen.getByText("Statistics")).toBeInTheDocument();
    expect(screen.queryByTitle("Share statistics")).not.toBeInTheDocument();
  });

  it("prompts an empty club to add its first review", async () => {
    server.use(noReviews());
    render(StatisticsView);

    expect(await screen.findByText("No Statistics Yet")).toBeInTheDocument();
    expect(
      screen.getByText(/Statistics will appear once your club has reviewed some movies/),
    ).toBeInTheDocument();
  });

  it("uses the club's own noun in the empty state", async () => {
    server.use(noReviews(), bookClub());
    render(StatisticsView);

    expect(
      await screen.findByText(/Statistics will appear once your club has reviewed some books/),
    ).toBeInTheDocument();
  });

  it("sends an empty club to the reviews page", async () => {
    server.use(noReviews());
    const { user } = render(StatisticsView);

    await user.click(await screen.findByRole("button", { name: /Go to Reviews/ }));

    expect(push).toHaveBeenCalledWith({ name: "Reviews" });
  });

  it("offers no share button for an empty club", async () => {
    server.use(noReviews());
    render(StatisticsView);

    await screen.findByText("No Statistics Yet");
    expect(screen.queryByTitle("Share statistics")).not.toBeInTheDocument();
  });

  it("copies the public statistics link when sharing", async () => {
    server.use(scoredReviews());
    const { user } = render(StatisticsView);
    // `userEvent.setup()` (inside render) installs its own navigator.clipboard,
    // so the spy has to go on that object — not one stubbed beforehand. jsdom's
    // desktop user agent keeps useShare on the copy-to-clipboard path.
    const writeText = vi.spyOn(navigator.clipboard, "writeText");

    await user.click(await screen.findByTitle("Share statistics"));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(
        `${window.location.origin}/share/club/test-club/statistics`,
      );
    });
  });

  it("shows an empty state when the reviews request fails", async () => {
    server.use(
      http.get("/api/club/:id/list/reviews", () => new HttpResponse(null, { status: 500 })),
    );
    render(StatisticsView);

    expect(await screen.findByText("No Statistics Yet")).toBeInTheDocument();
  });
});
