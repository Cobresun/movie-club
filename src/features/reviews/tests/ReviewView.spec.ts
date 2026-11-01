import { screen, waitFor } from "@testing-library/vue";
import { http, HttpResponse } from "msw";
import { z } from "zod";

import { type DetailedReviewListItem } from "../../../../lib/types/lists";
import ReviewView from "../views/ReviewView.vue";
import reviews from "@/mocks/data/reviews";
import { mockIntersectionObserver } from "@/mocks/IntersectionObserver";
import { server } from "@/mocks/server";
import { logIn, render } from "@/tests/utils";

mockIntersectionObserver();

/** A work the mock user (member "2") has scored, for score-assist fixtures. */
function memberScore(id: string, score: number) {
  return {
    workId: id,
    clubId: "1",
    clubName: "Test club",
    clubSlug: "test-club",
    type: "movie",
    title: `Movie ${id}`,
    score,
    scoredDate: "2024-05-28T04:46:37.751Z",
  };
}

describe("ReviewView", () => {
  afterEach(() => {
    localStorage.clear();
  });
  it("should render searchbox", async () => {
    render(ReviewView, { props: { clubSlug: "1" } });
    await expect(screen.findByRole("textbox")).resolves.toBeInTheDocument();
  });

  it("should open and close add review prompt", async () => {
    const { user } = render(ReviewView, { props: { clubSlug: "1" } });

    const openButton = await screen.findByRole("button", {
      name: "Add review",
    });
    await user.click(openButton);
    await expect(screen.findByText("From your lists")).resolves.toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByText("From your lists")).not.toBeInTheDocument();
  });

  it("should show human-readable sort options in the gallery sort menu", async () => {
    const { user } = render(ReviewView, { props: { clubSlug: "1" } });

    // Gallery view is the default; open the "Sort by" menu.
    const sortButton = await screen.findByRole("button", { name: /sort by/iu });
    await user.click(sortButton);

    // Members are spelled out as "<name>'s rating" instead of a bare avatar,
    // and the aggregate/date columns get plain-language labels too.
    await expect(
      screen.findByRole("option", { name: /dev's rating/iu }),
    ).resolves.toBeInTheDocument();
    expect(screen.getByRole("option", { name: /average rating/iu })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /date reviewed/iu })).toBeInTheDocument();
  });

  it("should describe the sort direction in words once a sort is chosen", async () => {
    const { user } = render(ReviewView, { props: { clubSlug: "1" } });

    const sortButton = await screen.findByRole("button", { name: /sort by/iu });
    await user.click(sortButton);

    await user.click(await screen.findByRole("option", { name: /average rating/iu }));

    // Direction reads as words rather than a bare chevron, and reverses on click.
    const directionButton = await screen.findByRole("button", {
      name: /highest first/iu,
    });
    await user.click(directionButton);
    await expect(
      screen.findByRole("button", { name: /lowest first/iu }),
    ).resolves.toBeInTheDocument();
  });

  it("should filter reviews when using search bar", async () => {
    const { user } = render(ReviewView, { props: { clubSlug: "1" } });
    const searchBar = await screen.findByRole("textbox");

    expect(screen.getAllByText("12 Angry Men")[0]).toBeInTheDocument();
    expect((await screen.findAllByText("The Empire Strikes Back"))[0]).toBeInTheDocument();

    await user.type(searchBar, "12");

    expect(screen.getAllByText("12 Angry Men")[0]).toBeInTheDocument();
    expect(screen.queryByText("The Empire Strikes Back")).not.toBeInTheDocument();
  });

  it("should submit score", async () => {
    const { user, pinia } = render(ReviewView, {
      props: { clubSlug: "test-club" },
    });
    logIn(pinia);

    // Score entry lives in the details drawer; open it for an unrated work.
    await user.click(await screen.findByRole("button", { name: "The Empire Strikes Back" }));
    await user.click(await screen.findByRole("button", { name: /rate this/iu }));

    const scoreInput = await screen.findByRole("spinbutton", { name: "Score" });
    expect(scoreInput).toBeInTheDocument();

    const newReviews = [
      reviews[0],
      {
        ...reviews[1],
        scores: {
          "2": {
            id: "test",
            createdDate: "2024-05-28T04:46:37.751Z",
            score: 10,
          },
          "3": {
            id: "test2",
            createdDate: "2024-05-28T04:46:37.751Z",
            score: 8,
          },
          average: {
            id: "average",
            createdDate: "2024-05-28T04:46:37.751Z",
            score: 9,
          },
        },
      },
    ];
    server.use(http.get("/api/club/:clubSlug/list/reviews", () => HttpResponse.json(newReviews)));

    await user.type(scoreInput, "10");
    await user.click(screen.getByRole("button", { name: "Save score" }));

    // Entry closes, and the drawer flips to the edit affordance now that the
    // user has a saved score for this work.
    expect(screen.queryByRole("spinbutton", { name: "Score" })).not.toBeInTheDocument();
    await expect(
      screen.findByRole("button", { name: /edit score/iu }),
    ).resolves.toBeInTheDocument();
  });

  it("removes only the user's own score, leaving the work on the reviews list", async () => {
    const { user, pinia } = render(ReviewView, {
      props: { clubSlug: "test-club" },
    });
    logIn(pinia);

    // "12 Angry Men" is the one work member "2" has scored in the fixture.
    await user.click(await screen.findByRole("button", { name: "12 Angry Men" }));
    await user.click(await screen.findByRole("button", { name: /edit score/i }));

    let deletedReviewId: string | undefined;
    server.use(
      http.delete("/api/club/:clubSlug/reviews/:reviewId", ({ params }) => {
        deletedReviewId = String(params.reviewId);
        return HttpResponse.json({});
      }),
      http.get("/api/club/:clubSlug/list/reviews", () =>
        HttpResponse.json([{ ...reviews[0], scores: {} }, reviews[1]]),
      ),
    );

    await user.click(screen.getByRole("button", { name: "Remove my score" }));
    await user.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() => {
      expect(deletedReviewId).toBe("test");
    });

    // The work is still on the list, unlike the club-wide "Delete review".
    expect(screen.queryByRole("spinbutton", { name: "Score" })).not.toBeInTheDocument();
    await expect(screen.findByRole("button", { name: /rate this/i })).resolves.toBeInTheDocument();
    expect(screen.getByText(/No scores yet/)).toBeInTheDocument();
    expect(screen.getAllByText("12 Angry Men").length).toBeGreaterThan(0);
  });

  it("shows who added a work and lets a member reattribute it", async () => {
    let items: DetailedReviewListItem[] = reviews.map((review) => ({ ...review, addedBy: "1" }));
    server.use(
      http.get("/api/club/:clubSlug/list/reviews", () =>
        HttpResponse.json<DetailedReviewListItem[]>(items),
      ),
      http.put("/api/club/:id/list/:listId/items/:workId/added-by", async ({ request, params }) => {
        const { userId } = z.object({ userId: z.string() }).parse(await request.json());
        items = items.map((item) =>
          item.id === params.workId ? { ...item, addedBy: userId } : item,
        );
        return new HttpResponse(null, { status: 200 });
      }),
    );
    const { user } = render(ReviewView, { props: { clubSlug: "test-club" } });

    await user.click(await screen.findByRole("button", { name: "12 Angry Men" }));
    expect(await screen.findByText("Added by dev")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Change who added" }));
    expect(await screen.findByRole("option", { name: "dev", selected: true })).toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: "cole" }));

    expect(await screen.findByText("Added by cole")).toBeInTheDocument();
  });

  it("keeps the review fact hidden until the club scores are revealed", async () => {
    // Ten scored works so all-time records apply; "Flop" — scored only by
    // member "3", not the signed-in user — is the club's lowest-rated.
    const history = Array.from({ length: 9 }, (_, i) => ({
      ...reviews[0],
      id: `past-${i}`,
      title: `Past ${i}`,
      externalId: `past-${i}`,
      createdDate: `2024-01-${String(i + 10).padStart(2, "0")}T00:00:00.000Z`,
      scores: {
        "3": { id: `r-${i}`, createdDate: "2024-01-01T00:00:00.000Z", score: 7 },
        average: { id: "average", createdDate: "2024-01-01T00:00:00.000Z", score: 7 },
      },
    }));
    const flop = {
      ...reviews[1],
      title: "Flop",
      createdDate: "2024-01-01T00:00:00.000Z",
      scores: {
        "3": { id: "flop", createdDate: "2024-01-01T00:00:00.000Z", score: 2 },
        average: { id: "average", createdDate: "2024-01-01T00:00:00.000Z", score: 2 },
      },
    };
    server.use(
      http.get("/api/club/:clubSlug/list/reviews", () => HttpResponse.json([flop, ...history])),
    );

    const { user, pinia } = render(ReviewView, { props: { clubSlug: "test-club" } });
    logIn(pinia);

    await user.click(await screen.findByRole("button", { name: "Flop" }));
    const reveal = await screen.findByRole("button", { name: "Reveal club scores" });
    // The fact arms on idle after the drawer opens; give it the chance to.
    await new Promise((resolve) => {
      setTimeout(resolve, 400);
    });
    expect(screen.queryByText(/lowest-rated/)).not.toBeInTheDocument();

    await user.click(reveal);
    expect(await screen.findByText(/lowest-rated movie in club history/)).toBeInTheDocument();
  });

  it("hides the score-assist button while the user has fewer than five scored works", async () => {
    // Default fixture: the member has no scores in any club.
    const { user, pinia } = render(ReviewView, {
      props: { clubSlug: "test-club" },
    });
    logIn(pinia);

    // Open the drawer for an unrated work and start score entry.
    await user.click(await screen.findByRole("button", { name: "The Empire Strikes Back" }));
    await user.click(await screen.findByRole("button", { name: /rate this/iu }));

    // The entry panel opens, but the assist button is absent (not eligible).
    await expect(screen.findByRole("spinbutton", { name: "Score" })).resolves.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Compare to decide/u })).not.toBeInTheDocument();
  });

  it("opens score assist from the entry panel once the user has five scored works", async () => {
    const unscored = {
      id: "t1",
      title: "Unscored Movie",
      createdDate: "2024-05-28T04:46:37.751Z",
      type: "movie",
      scores: {},
    };
    server.use(
      http.get("/api/club/:clubSlug/list/reviews", () => HttpResponse.json([unscored])),
      // The comparison pool is the member's scores across all of their clubs.
      http.get("/api/member/scores", () =>
        HttpResponse.json([2, 3, 4, 5, 6, 7].map((n) => memberScore(`m${n}`, n))),
      ),
    );

    const { user, pinia } = render(ReviewView, {
      props: { clubSlug: "test-club" },
    });
    logIn(pinia);

    // Open the drawer for the only unscored work and start score entry.
    await user.click(await screen.findByRole("button", { name: "Unscored Movie" }));
    await user.click(await screen.findByRole("button", { name: /rate this/iu }));

    const trigger = await screen.findByRole("button", {
      name: /Compare to decide/u,
    });
    await user.click(trigger);

    await expect(screen.findByText("Which movie did you like more?")).resolves.toBeInTheDocument();
    // The entry panel closed when the assist flow took over the modal.
    expect(screen.queryByRole("spinbutton", { name: "Score" })).not.toBeInTheDocument();
  });
});
