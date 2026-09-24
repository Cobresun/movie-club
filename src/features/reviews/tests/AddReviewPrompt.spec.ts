import { screen, waitFor, within } from "@testing-library/vue";
import { config } from "@vue/test-utils";
import { http, HttpResponse } from "msw";

import { listInsertDtoSchema } from "../../../../lib/types/lists";
import AddReviewPrompt from "../components/AddReviewPrompt.vue";
import ReviewView from "../views/ReviewView.vue";
import { mockIntersectionObserver } from "@/mocks/IntersectionObserver";
import { server } from "@/mocks/server";
import { render } from "@/tests/utils";

mockIntersectionObserver();

// vue-toastification renders inside a <transition-group>, which VTU stubs by
// default and so drops the toast text; un-stub transitions to read it.
config.global.stubs = { transition: false, "transition-group": false };

const MARIO = "The Super Mario Bros. Movie";
const moveEndpoint = "/api/club/:id/list/:listId/items/:workId/move";

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
      queue(listInsertDtoSchema.parse(await request.json()));
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

  it("shows the work on the reviews page before the move has landed", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    // Resolving with nothing hands the request on to reviewsApi's move handler.
    server.use(
      allItems(),
      http.post(moveEndpoint, async () => {
        await gate;
      }),
      ...reviewsApi(),
    );
    const { user } = render(ReviewView, { props: { clubSlug: "test-club" } });

    await user.click(await screen.findByRole("button", { name: "Add review" }));
    await user.click(await screen.findByText(MARIO));

    expect(await screen.findByRole("heading", { name: MARIO })).toBeInTheDocument();
    expect(screen.queryByText("From your lists")).not.toBeInTheDocument();
    release();
  });

  it("takes the work back off the reviews page when the move fails", async () => {
    server.use(
      allItems(),
      http.post(moveEndpoint, () => HttpResponse.json({ message: "boom" }, { status: 500 })),
      ...reviewsApi(),
    );
    const { user } = render(ReviewView, { props: { clubSlug: "test-club" } });

    await user.click(await screen.findByRole("button", { name: "Add review" }));
    await user.click(await screen.findByText(MARIO));

    expect(
      await screen.findAllByText(`Failed to move "${MARIO}" to reviews. Please try again.`),
    ).not.toHaveLength(0);
    expect(screen.queryByRole("heading", { name: MARIO })).not.toBeInTheDocument();
  });

  it("says a work has already been reviewed instead of queuing it again", async () => {
    server.use(allItems(), ...reviewsApi([{ ...listItems[0], scores: {} }]));
    const { user } = render(ReviewView, { props: { clubSlug: "test-club" } });

    await screen.findByRole("heading", { name: MARIO });
    await user.click(screen.getByRole("button", { name: "Add review" }));
    await user.click(await within(await screen.findByRole("dialog")).findByText(MARIO));

    expect(await screen.findAllByText(`"${MARIO}" has already been reviewed.`)).not.toHaveLength(0);
    expect(screen.getByText("From your lists")).toBeInTheDocument();
  });

  it("says a work found through search has already been reviewed", async () => {
    server.use(
      allItems([]),
      tmdbSearch("Fight Club"),
      http.post("/api/club/:id/list/:listId/items", () =>
        HttpResponse.json({ error: "Item is already in list" }, { status: 400 }),
      ),
      ...reviewsApi(),
    );
    const { user } = render(ReviewView, { props: { clubSlug: "test-club" } });

    await user.click(await screen.findByRole("button", { name: "Add review" }));
    await user.type(await screen.findByPlaceholderText("Type to filter or search"), "Fight Club");
    await user.click(await screen.findByText("Fight Club"));

    expect(await screen.findAllByText('"Fight Club" has already been reviewed.')).not.toHaveLength(
      0,
    );
    expect(screen.getByPlaceholderText("Type to filter or search")).toBeInTheDocument();
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
