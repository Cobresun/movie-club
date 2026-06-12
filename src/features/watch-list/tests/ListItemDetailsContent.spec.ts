import { screen } from "@testing-library/vue";
import { http, HttpResponse } from "msw";

import { WorkType } from "../../../../lib/types/generated/db";
import { DetailedWorkListItem } from "../../../../lib/types/lists";
import ListItemDetailsContent from "../components/ListItemDetailsContent.vue";

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

const baseProps = {
  movie,
  clubSlug: "test-club",
  isNextWork: false,
  isDesktop: true,
  canReview: true,
  otherLists: [],
};

// The panel embeds CommentThread and WatchProviders, which both fetch.
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

describe("ListItemDetailsContent", () => {
  it("renders the work title", async () => {
    render(ListItemDetailsContent, { props: baseProps });

    expect(await screen.findByText("Inception")).toBeInTheDocument();
  });

  it("emits set-next-work from the 'Up Next' action", async () => {
    const { user, emitted } = render(ListItemDetailsContent, {
      props: baseProps,
    });

    await user.click(screen.getByRole("button", { name: "Up Next" }));

    expect(emitted()["set-next-work"]).toHaveLength(1);
  });

  it("emits clear-next-work from the 'Unpin' action when already next up", async () => {
    const { user, emitted } = render(ListItemDetailsContent, {
      props: { ...baseProps, isNextWork: true },
    });

    await user.click(screen.getByRole("button", { name: "Unpin" }));

    expect(emitted()["clear-next-work"]).toHaveLength(1);
  });

  it("emits review from the 'Reviewed' action when reviewing is allowed", async () => {
    const { user, emitted } = render(ListItemDetailsContent, {
      props: baseProps,
    });

    await user.click(screen.getByRole("button", { name: "Reviewed" }));

    expect(emitted()["review"]).toHaveLength(1);
  });

  it("hides the 'Reviewed' action when reviewing is not allowed", () => {
    render(ListItemDetailsContent, {
      props: { ...baseProps, canReview: false },
    });

    expect(
      screen.queryByRole("button", { name: "Reviewed" }),
    ).not.toBeInTheDocument();
  });
});
