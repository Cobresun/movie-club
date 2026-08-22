import { screen, waitFor } from "@testing-library/vue";
import { http, HttpResponse } from "msw";

import AddReviewPrompt from "../components/AddReviewPrompt.vue";
import ReviewView from "../views/ReviewView.vue";
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

/**
 * A reviews list that keeps what the prompt sends it, whether the work is
 * moved off another list or added straight from a search. Queuing a review is
 * only observable on the reviews page, so the round trip is asserted there
 * rather than on the request the prompt made.
 */
const reviewsApi = (initial: unknown[] = []) => {
  let reviews = [...initial];
  const queue = (work: Record<string, unknown>) => {
    reviews = [...reviews, { ...work, scores: {} }];
  };

  return [
    http.get("/api/club/:id/list/reviews", () => HttpResponse.json(reviews)),
    http.post("/api/club/:id/list/:listId/items/:workId/move", ({ params }) => {
      const moving = listItems.find((item) => item.id === params.workId);
      if (moving) queue(moving);
      return new HttpResponse(null, { status: 200 });
    }),
    http.post("/api/club/:id/list/:listId/items", async ({ request }) => {
      queue((await request.json()) as Record<string, unknown>);
      return new HttpResponse(null, { status: 200 });
    }),
  ];
};

const tmdbSearch = (title: string) =>
  http.get("https://api.themoviedb.org/3/search/movie", () =>
    HttpResponse.json({
      page: 1,
      total_pages: 1,
      total_results: 1,
      results: [{ id: 550, title, release_date: "1999-10-15", poster_path: "/fc.jpg" }],
    }),
  );

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

  it("closes once a work has been picked", async () => {
    server.use(allItems(), ...reviewsApi());
    const rendered = render(AddReviewPrompt);

    await rendered.user.click(await screen.findByText("The Super Mario Bros. Movie"));

    await waitFor(() => {
      expect(rendered.emitted().close).toBeTruthy();
    });
  });

  it("closes when the user presses Escape", async () => {
    server.use(allItems());
    const rendered = render(AddReviewPrompt);

    await screen.findByText("From your lists");
    await rendered.user.keyboard("{Escape}");

    expect(rendered.emitted().close).toBeTruthy();
  });

  it("spins while the club's lists are still loading", () => {
    render(AddReviewPrompt);

    expect(screen.queryByText("From your lists")).not.toBeInTheDocument();
  });
});

describe("queuing a review from the prompt", () => {
  it("puts a work from another list onto the reviews page", async () => {
    server.use(allItems(), ...reviewsApi());
    const { user } = render(ReviewView, { props: { clubSlug: "test-club" } });

    await user.click(await screen.findByRole("button", { name: "Add review" }));
    await user.click(await screen.findByText("The Super Mario Bros. Movie"));

    expect(
      await screen.findByRole("heading", { name: "The Super Mario Bros. Movie" }),
    ).toBeInTheDocument();
  });

  it("puts a work found through search onto the reviews page", async () => {
    // The baseline TMDB handler returns no results, so a searchable movie is
    // supplied here.
    server.use(allItems([]), tmdbSearch("Fight Club"), ...reviewsApi());
    const { user } = render(ReviewView, { props: { clubSlug: "test-club" } });

    await user.click(await screen.findByRole("button", { name: "Add review" }));
    await user.type(await screen.findByPlaceholderText("Type to filter or search"), "Fight Club");
    await user.click(await screen.findByText("Fight Club"));

    expect(await screen.findByRole("heading", { name: "Fight Club" })).toBeInTheDocument();
  });
});
