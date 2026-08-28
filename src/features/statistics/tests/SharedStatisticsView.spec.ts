import { screen } from "@testing-library/vue";
import { http, HttpResponse } from "msw";

import SharedStatisticsView from "../views/SharedStatisticsView.vue";
import { SCORED_MOVIE_REVIEW } from "./fixtures";
import { mockIntersectionObserver } from "@/mocks/IntersectionObserver";
import { server } from "@/mocks/server";
import { render } from "@/tests/utils";

vi.mock("ag-charts-vue3", async () => await import("@/mocks/agCharts"));

mockIntersectionObserver();

const noReviews = () => http.get("/api/club/:id/list/reviews", () => HttpResponse.json([]));

const bookClub = () =>
  http.get("/api/club/:id", () =>
    HttpResponse.json({ clubId: 1, clubName: "Test club", type: "book" }),
  );

const scoredReviews = () =>
  http.get("/api/club/:id/list/reviews", () => HttpResponse.json([SCORED_MOVIE_REVIEW]));

describe("SharedStatisticsView", () => {
  it("heads the page with the club's name", async () => {
    server.use(scoredReviews());
    render(SharedStatisticsView);

    expect(await screen.findByText("Test club")).toBeInTheDocument();
    expect(screen.getByText("Statistics")).toBeInTheDocument();
  });

  it("renders the statistics widgets for a public visitor", async () => {
    server.use(scoredReviews());
    render(SharedStatisticsView);

    expect(await screen.findByText("movies watched")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Scores" })).toBeInTheDocument();
  });

  it("offers no share button, unlike the members-only view", async () => {
    server.use(scoredReviews());
    render(SharedStatisticsView);

    await screen.findByText("movies watched");
    expect(screen.queryByTitle("Share statistics")).not.toBeInTheDocument();
  });

  it("shows a visitor-facing empty state for a club with no reviews", async () => {
    server.use(noReviews());
    render(SharedStatisticsView);

    expect(await screen.findByText("No Statistics Yet")).toBeInTheDocument();
    expect(
      screen.getByText("Statistics will appear once this club has reviewed some movies."),
    ).toBeInTheDocument();
    // The public page has nothing to send a non-member to.
    expect(screen.queryByRole("button", { name: /Go to Reviews/ })).not.toBeInTheDocument();
  });

  it("uses the club's own noun in the empty state", async () => {
    server.use(noReviews(), bookClub());
    render(SharedStatisticsView);

    expect(
      await screen.findByText("Statistics will appear once this club has reviewed some books."),
    ).toBeInTheDocument();
  });

  it("falls back to the slug when the club fails to load", async () => {
    server.use(
      noReviews(),
      http.get("/api/club/:id", () => new HttpResponse(null, { status: 500 })),
    );
    render(SharedStatisticsView);

    expect(await screen.findByText("test-club")).toBeInTheDocument();
  });
});
