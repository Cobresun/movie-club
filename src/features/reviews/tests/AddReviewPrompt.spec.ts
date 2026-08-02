import { screen, waitFor } from "@testing-library/vue";
import { http, HttpResponse } from "msw";

import AddReviewPrompt from "../components/AddReviewPrompt.vue";
import { mockIntersectionObserver } from "@/mocks/IntersectionObserver";
import { server } from "@/mocks/server";
import { render } from "@/tests/utils";

mockIntersectionObserver();

const listItems = [
  {
    id: "item-1",
    title: "The Super Mario Bros. Movie",
    type: "movie",
    createdDate: "2023-06-17T06:00:00.000Z",
    imageUrl: "https://image.tmdb.org/mario.jpg",
    externalId: "502356",
    sourceListId: "1",
    sourceListTitle: "Watch List",
    externalData: {
      kind: "movie",
      castNames: [],
      directors: [],
      genres: [],
      release_date: "2023-04-05",
    },
  },
];

const allItems = (items: unknown[] = listItems) =>
  http.get("/api/club/:id/list/all-items", () => HttpResponse.json(items));

describe("AddReviewPrompt", () => {
  it("lists the works already on the club's lists", async () => {
    server.use(allItems());
    render(AddReviewPrompt);

    expect(await screen.findByText("From your lists")).toBeInTheDocument();
    expect(screen.getByText("The Super Mario Bros. Movie")).toBeInTheDocument();
  });

  it("shows a search box for finding works that are not on a list", async () => {
    server.use(allItems());
    render(AddReviewPrompt);

    expect(await screen.findByPlaceholderText("Type to filter or search")).toBeInTheDocument();
  });

  it("filters the list as the user types", async () => {
    server.use(
      allItems([
        ...listItems,
        { ...listItems[0], id: "item-2", externalId: "438631", title: "Dune" },
      ]),
    );
    const { user } = render(AddReviewPrompt);

    await screen.findByText("Dune");
    await user.type(screen.getByPlaceholderText("Type to filter or search"), "Mario");

    expect(screen.getByText("The Super Mario Bros. Movie")).toBeInTheDocument();
    expect(screen.queryByText("Dune")).not.toBeInTheDocument();
  });

  it("queues a review by moving the work out of its source list", async () => {
    const moved = vi.fn();
    server.use(
      allItems(),
      http.post("/api/club/:id/list/:listId/items/:workId/move", ({ params }) => {
        moved(params);
        return new HttpResponse(null, { status: 200 });
      }),
    );
    const { user, emitted } = render(AddReviewPrompt);

    await user.click(await screen.findByText("The Super Mario Bros. Movie"));

    await waitFor(() => {
      expect(moved).toHaveBeenCalledWith(
        expect.objectContaining({ listId: "1", workId: "item-1" }),
      );
    });
    expect(emitted().close).toBeTruthy();
  });

  it("adds a work found through search straight to the reviews list", async () => {
    const added = vi.fn();
    server.use(
      allItems([]),
      // The baseline TMDB handler returns no results, so a searchable movie is
      // supplied here.
      http.get("https://api.themoviedb.org/3/search/movie", () =>
        HttpResponse.json({
          page: 1,
          total_pages: 1,
          total_results: 1,
          results: [
            { id: 550, title: "Fight Club", release_date: "1999-10-15", poster_path: "/fc.jpg" },
          ],
        }),
      ),
      http.post("/api/club/:id/list/:listId/items", async ({ request, params }) => {
        added({ listId: params.listId, body: await request.json() });
        return new HttpResponse(null, { status: 200 });
      }),
    );
    const { user, emitted } = render(AddReviewPrompt);

    await user.type(await screen.findByPlaceholderText("Type to filter or search"), "Fight Club");

    await user.click(await screen.findByText("Fight Club"));

    await waitFor(() => {
      expect(added).toHaveBeenCalledWith(
        expect.objectContaining({
          listId: "reviews",
          body: expect.objectContaining({ type: "movie", title: "Fight Club" }),
        }),
      );
    });
    expect(emitted().close).toBeTruthy();
  });

  it("closes when the user presses Escape", async () => {
    server.use(allItems());
    const { user, emitted } = render(AddReviewPrompt);

    await screen.findByText("From your lists");
    await user.keyboard("{Escape}");

    expect(emitted().close).toBeTruthy();
  });

  it("spins while the club's lists are still loading", () => {
    render(AddReviewPrompt);

    expect(screen.queryByText("From your lists")).not.toBeInTheDocument();
  });
});
