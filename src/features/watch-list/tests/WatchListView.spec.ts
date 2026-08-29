import { screen } from "@testing-library/vue";
import { http, HttpResponse } from "msw";

import WatchListView from "../views/WatchListView.vue";
import { mockIntersectionObserver } from "@/mocks/IntersectionObserver";
import { server } from "@/mocks/server";
import { render } from "@/tests/utils";

mockIntersectionObserver();

beforeEach(() => {
  server.use(
    http.get("/api/club/:id/nextWork", () => HttpResponse.json({ workId: null })),
    http.get("https://api.themoviedb.org/3/movie/:movieId/watch/providers", () =>
      HttpResponse.json({ id: 502356, results: {} }),
    ),
  );
});

describe("WatchListView", () => {
  it("renders each list with its title and item count", async () => {
    render(WatchListView);

    // Baseline /list handler returns one list, "Watch List" with itemCount 1.
    expect(await screen.findByRole("heading", { name: "Watch List" })).toBeInTheDocument();
    expect(screen.getByText("(1)")).toBeInTheDocument();
  });

  it("opens the manage-lists modal", async () => {
    const { user } = render(WatchListView);

    await user.click(await screen.findByRole("button", { name: "Manage" }));

    expect(await screen.findByText("Manage Lists")).toBeInTheDocument();
  });

  it("shows the empty state when the club has no lists", async () => {
    server.use(http.get("/api/club/:id/list", () => HttpResponse.json([])));

    render(WatchListView);

    expect(await screen.findByText("No lists yet")).toBeInTheDocument();
  });

  it("opens an item's details when its poster is clicked", async () => {
    const title = "The Super Mario Bros. Movie";
    const { user } = render(WatchListView);

    await user.click(await screen.findByRole("button", { name: title }));

    // The panel carries the per-item actions and the added-on line that only
    // it offers; the title is already on the card behind it.
    expect(await screen.findByRole("button", { name: "Up Next" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
    expect(screen.getByText(/^Added /)).toBeInTheDocument();
  });
});
