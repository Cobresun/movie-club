import { screen } from "@testing-library/vue";
import { http, HttpResponse } from "msw";

import AddWorkModal from "../components/AddWorkModal.vue";

import { mockIntersectionObserver } from "@/mocks/IntersectionObserver";
import { server } from "@/mocks/server";
import { render } from "@/tests/utils";

mockIntersectionObserver();

// One representative title per TMDB collection so a tab switch is observable.
const titleByCollection: Record<string, string> = {
  popular: "Popular Pick",
  now_playing: "Now Playing Pick",
  upcoming: "Upcoming Pick",
  top_rated: "Top Rated Pick",
};

beforeEach(() => {
  server.use(
    http.get("https://api.themoviedb.org/3/movie/:collection", ({ params }) => {
      const collection = String(params.collection);
      return HttpResponse.json({
        page: 1,
        total_pages: 1,
        total_results: 1,
        results: [
          {
            id: 100,
            title: titleByCollection[collection] ?? "Unknown",
            release_date: "2024-01-01",
            poster_path: "/p.jpg",
          },
        ],
      });
    }),
  );
});

describe("AddWorkModal", () => {
  it("shows the Popular collection by default", async () => {
    render(AddWorkModal, { props: { listId: "1" } });

    expect(await screen.findByText("Popular Pick")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Popular" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Now Playing" }),
    ).toBeInTheDocument();
  });

  it("switches the collection when another tab is selected", async () => {
    const { user } = render(AddWorkModal, { props: { listId: "1" } });

    await screen.findByText("Popular Pick");
    await user.click(screen.getByRole("button", { name: "Now Playing" }));

    expect(await screen.findByText("Now Playing Pick")).toBeInTheDocument();
  });
});
