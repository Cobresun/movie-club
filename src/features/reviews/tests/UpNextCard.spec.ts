import { screen, within } from "@testing-library/vue";
import { http, HttpResponse } from "msw";

import ReviewView from "../views/ReviewView.vue";
import { mockIntersectionObserver } from "@/mocks/IntersectionObserver";
import { server } from "@/mocks/server";
import { logIn, render } from "@/tests/utils";

mockIntersectionObserver();

const work = (id: string, title: string) => ({
  id,
  title,
  type: "movie",
  createdDate: "2023-06-17T06:00:00.000Z",
  imageUrl: `https://image.tmdb.org/${id}.jpg`,
  externalId: id,
  externalData: {
    kind: "movie",
    castNames: [],
    directors: [],
    genres: [],
    release_date: "2023-04-05",
  },
});

const onList = (item: ReturnType<typeof work>, listId: string, listTitle: string) => ({
  ...item,
  sourceListId: listId,
  sourceListTitle: listTitle,
});

const mario = work("mario", "The Super Mario Bros. Movie");
const dune = work("dune", "Dune");

/**
 * The club's lists and reviews list as one store that keeps what a move sends
 * it: the work leaves its source list and lands on the reviews page, the same
 * round trip the API gives the app.
 */
const clubApi = ({
  nextWorkId,
  listItems,
}: {
  nextWorkId?: string;
  listItems: ReturnType<typeof onList>[];
}) => {
  let items = [...listItems];
  let reviews: unknown[] = [];

  return [
    http.get("/api/club/:id/nextWork", () => HttpResponse.json({ workId: nextWorkId })),
    http.get("https://api.themoviedb.org/3/movie/:movieId/watch/providers", () =>
      HttpResponse.json({ results: {} }),
    ),
    http.get("/api/club/:id/list/all-items", () => HttpResponse.json(items)),
    http.get("/api/club/:id/list/reviews", () => HttpResponse.json(reviews)),
    http.post("/api/club/:id/list/:listId/items/:workId/move", ({ params }) => {
      const moving = items.find(
        (item) => item.id === params.workId && item.sourceListId === params.listId,
      );
      if (moving) {
        items = items.filter((item) => item !== moving);
        const { sourceListId: _list, sourceListTitle: _title, ...rest } = moving;
        reviews = [...reviews, { ...rest, scores: {} }];
      }
      return new HttpResponse(null, { status: 200 });
    }),
  ];
};

describe("Up next on the reviews page", () => {
  it("shows the club's next watch with the list it is on", async () => {
    server.use(
      ...clubApi({
        nextWorkId: "mario",
        listItems: [onList(dune, "1", "Watch List"), onList(mario, "1", "Watch List")],
      }),
    );
    render(ReviewView, { props: { clubSlug: "test-club" } });

    const card = await screen.findByRole("region", { name: "Up next" });
    expect(within(card).getByRole("heading", { name: mario.title })).toBeInTheDocument();
    expect(within(card).getByText("From Watch List")).toBeInTheDocument();
    expect(within(card).queryByText(dune.title)).not.toBeInTheDocument();
  });

  it("names the topmost list when the next watch is on several", async () => {
    server.use(
      ...clubApi({
        nextWorkId: "mario",
        listItems: [onList(mario, "top", "Top Picks"), onList(mario, "later", "Someday")],
      }),
    );
    render(ReviewView, { props: { clubSlug: "test-club" } });

    const card = await screen.findByRole("region", { name: "Up next" });
    expect(within(card).getByText("From Top Picks")).toBeInTheDocument();
    expect(within(card).queryByText("From Someday")).not.toBeInTheDocument();
  });

  it("is absent when nothing is up next", async () => {
    server.use(...clubApi({ listItems: [onList(mario, "1", "Watch List")] }));
    render(ReviewView, { props: { clubSlug: "test-club" } });

    expect(await screen.findByText("No Reviews Yet")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Up next" })).not.toBeInTheDocument();
  });

  it("moves the next watch into reviews and opens it ready to score", async () => {
    server.use(
      ...clubApi({
        nextWorkId: "mario",
        listItems: [onList(mario, "top", "Top Picks"), onList(mario, "later", "Someday")],
      }),
    );
    const { user, pinia } = render(ReviewView, { props: { clubSlug: "test-club" } });
    logIn(pinia);

    await user.click(await screen.findByRole("button", { name: `Review ${mario.title}` }));

    expect(await screen.findByRole("button", { name: /rate this movie/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: mario.title })).toBeInTheDocument();
    // Still on "Someday", but already being reviewed, so no longer up next.
    expect(screen.queryByRole("region", { name: "Up next" })).not.toBeInTheDocument();
  });
});
