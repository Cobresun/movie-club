import { screen } from "@testing-library/vue";
import { http, HttpResponse } from "msw";

import WatchListView from "../views/WatchListView.vue";

import { mockIntersectionObserver } from "@/mocks/IntersectionObserver";
import { server } from "@/mocks/server";
import { render } from "@/tests/utils";

mockIntersectionObserver();

beforeEach(() => {
  server.use(
    http.get("/api/club/:id/nextWork", () =>
      HttpResponse.json({ workId: null }),
    ),
  );
});

describe("WatchListView", () => {
  it("renders each list with its title and item count", async () => {
    render(WatchListView);

    // Baseline /list handler returns one list, "Watch List" with itemCount 1.
    expect(
      await screen.findByRole("heading", { name: "Watch List" }),
    ).toBeInTheDocument();
    expect(screen.getByText("(1)")).toBeInTheDocument();
  });

  it("opens the manage-lists modal", async () => {
    const { user } = render(WatchListView);

    await user.click(
      await screen.findByRole("button", { name: "Manage lists" }),
    );

    expect(await screen.findByText("Manage Lists")).toBeInTheDocument();
  });

  it("shows the empty state when the club has no lists", async () => {
    server.use(http.get("/api/club/:id/list", () => HttpResponse.json([])));

    render(WatchListView);

    expect(await screen.findByText("No lists yet")).toBeInTheDocument();
  });
});
