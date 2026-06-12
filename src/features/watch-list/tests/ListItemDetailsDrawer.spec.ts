import { screen } from "@testing-library/vue";
import { http, HttpResponse } from "msw";

import { WorkType } from "../../../../lib/types/generated/db";
import { DetailedWorkListItem } from "../../../../lib/types/lists";
import ListItemDetailsDrawer from "../components/ListItemDetailsDrawer.vue";

import { mockIntersectionObserver } from "@/mocks/IntersectionObserver";
import { server } from "@/mocks/server";
import { render } from "@/tests/utils";

mockIntersectionObserver();

const movie: DetailedWorkListItem = {
  id: "w1",
  type: WorkType.movie,
  title: "Inception",
  createdDate: "2024-05-01T00:00:00.000Z",
  externalId: "27205",
  imageUrl: "https://test.com/poster.jpg",
  externalData: {
    kind: "movie",
    actors: [],
    directors: [],
    genres: [],
    production_companies: [],
    production_countries: [],
  },
};

const props = {
  movie,
  clubSlug: "test-club",
  isNextWork: false,
  canReview: true,
  otherLists: [],
};

beforeEach(() => {
  server.use(
    http.get("/api/club/:id/reviews/:workId/comments", () =>
      HttpResponse.json([]),
    ),
    http.get(
      "https://api.themoviedb.org/3/movie/:movieId/watch/providers",
      () => HttpResponse.json({ id: 27205, results: {} }),
    ),
  );
});

describe("ListItemDetailsDrawer", () => {
  it("renders the embedded item details", async () => {
    render(ListItemDetailsDrawer, { props });

    expect(await screen.findByText("Inception")).toBeInTheDocument();
  });

  it("forwards the set-next-work action from the content", async () => {
    const { user, emitted } = render(ListItemDetailsDrawer, { props });

    await user.click(await screen.findByRole("button", { name: "Up Next" }));

    expect(emitted()["set-next-work"]).toHaveLength(1);
  });
});
