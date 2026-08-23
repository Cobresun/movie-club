import { http, HttpResponse } from "msw";

import { ReviewScores } from "../../../lib/types/lists";
import { useReviewsList } from "../useList";
import {
  useAddReviewComment,
  useDeleteReviewComment,
  useDeleteScore,
  useEditReviewComment,
  useReviewComments,
  useSubmitScore,
} from "../useReviews";
import { comment, commentsApi } from "@/mocks/comments";
import memberData from "@/mocks/data/member.json";
import { server } from "@/mocks/server";
import { logIn, withSetup } from "@/tests/utils";

/** Runs the comment thread query alongside the mutation under test. */
function withThread<T>(mutation: () => T) {
  return () => ({ thread: useReviewComments("test-club", "work-1"), mutation: mutation() });
}

/** The thread's contents as `content` / `content (spoiler)`. */
function contents(thread: ReturnType<typeof useReviewComments>) {
  return thread.data.value?.map((c) => (c.spoiler ? `${c.content} (spoiler)` : c.content));
}

// ---------------------------------------------------------------------------
// useSubmitScore
//
// The create and update mutations it picks between are module-private, so both
// paths are driven through this — the surface ReviewScore, ScoreEntryPanel and
// ScoreAssistModal actually call.
// ---------------------------------------------------------------------------

describe("useSubmitScore", () => {
  /**
   * One work on the reviews list, behind an API that scores it the way the real
   * one does: a work is created once and updated after that.
   */
  function reviewedWork(existing: { reviewId?: string; score?: number } = {}) {
    const scoresOf = (score: number) => ({
      "u-1": { id: "score-1", createdDate: "2024-05-28T04:46:37.751Z", score },
    });
    const work = {
      id: "work-1",
      title: "Fight Club",
      type: "movie",
      externalId: "550",
      createdDate: "2024-05-28T04:46:37.751Z",
      reviewId: existing.reviewId,
      scores: existing.score === undefined ? {} : scoresOf(existing.score),
    };

    return [
      http.get("/api/club/:id/list/reviews", () => HttpResponse.json([work])),
      http.get("/api/club/:id/reviews/:workId/scores", () => HttpResponse.json(work.scores)),
      http.post("/api/club/:id/reviews", async ({ request }) => {
        const { workId, score } = (await request.json()) as { workId: string; score: number };
        if (workId !== work.id) return new HttpResponse(null, { status: 404 });
        if (work.reviewId !== undefined) return new HttpResponse(null, { status: 409 });
        work.reviewId = "rev-42";
        work.scores = scoresOf(score);
        return HttpResponse.json({});
      }),
      http.put("/api/club/:id/reviews/:reviewId", async ({ request, params }) => {
        if (params.reviewId !== work.reviewId) return new HttpResponse(null, { status: 404 });
        const { score } = (await request.json()) as { score: number };
        work.scores = scoresOf(score);
        return HttpResponse.json({});
      }),
    ];
  }

  const scoreOnList = (reviews: ReturnType<typeof useReviewsList>) =>
    reviews.data.value?.[0]?.scores["u-1"]?.score;

  it("scores a work that has no review yet", async () => {
    server.use(...reviewedWork());

    const { result } = withSetup(() => ({
      reviews: useReviewsList("test-club"),
      submit: useSubmitScore("test-club"),
    }));

    await vi.waitFor(() => {
      expect(scoreOnList(result.reviews)).toBeUndefined();
    });

    result.submit({ workId: "work-1", score: 8 });

    await vi.waitFor(() => {
      expect(scoreOnList(result.reviews)).toBe(8);
    });
  });

  it("replaces the score on a work that is already reviewed", async () => {
    server.use(...reviewedWork({ reviewId: "rev-42", score: 5 }));

    const { result } = withSetup(() => ({
      reviews: useReviewsList("test-club"),
      submit: useSubmitScore("test-club"),
    }));

    await vi.waitFor(() => {
      expect(scoreOnList(result.reviews)).toBe(5);
    });

    result.submit({ workId: "work-1", reviewId: "rev-42", score: 7 });

    await vi.waitFor(() => {
      expect(scoreOnList(result.reviews)).toBe(7);
    });
  });
});

// ---------------------------------------------------------------------------
// useDeleteScore (optimistic)
// ---------------------------------------------------------------------------

describe("useDeleteScore", () => {
  const score = (id: string, value: number) => ({
    id,
    created_date: "2024-05-28T04:46:37.751Z",
    score: value,
  });

  /**
   * One scored work behind an API whose DELETE only answers once the test says
   * so, which is what leaves the optimistic cache write observable: the
   * invalidation that follows the response would otherwise overwrite it.
   */
  function scoredWork(scores: ReviewScores) {
    const work = {
      id: "work-1",
      title: "12 Angry Men",
      type: "movie",
      createdDate: "2024-05-28T04:46:37.751Z",
      scores,
    };
    let release!: () => void;
    const answered = new Promise<void>((resolve) => (release = resolve));

    return {
      handlers: [
        http.get("/api/club/:id/list/reviews", () => HttpResponse.json([work])),
        http.delete("/api/club/:id/reviews/:reviewId", async () => {
          await answered;
          return HttpResponse.json({});
        }),
      ],
      /** Answers the DELETE, with the scores the server reports afterwards. */
      finish: (after: ReviewScores) => {
        work.scores = after;
        release();
      },
    };
  }

  const scoresOnList = (reviews: ReturnType<typeof useReviewsList>) =>
    reviews.data.value?.[0]?.scores;

  function removeScore(handlers: ReturnType<typeof scoredWork>["handlers"]) {
    server.use(...handlers);

    const { result, pinia } = withSetup(() => ({
      reviews: useReviewsList("test-club"),
      remove: useDeleteScore("test-club"),
    }));
    logIn(pinia);

    return result;
  }

  it("drops the member's score and recomputes the average from what is left", async () => {
    const { handlers, finish } = scoredWork({
      [memberData.id]: score("review-mine", 10),
      "3": score("review-theirs", 6),
      average: score("average", 8),
    });
    const result = removeScore(handlers);

    await vi.waitFor(() => {
      expect(scoresOnList(result.reviews)?.average.score).toBe(8);
    });

    result.remove.mutate({ reviewId: "review-mine", workId: "work-1" });

    await vi.waitFor(() => {
      expect(scoresOnList(result.reviews)?.[memberData.id]).toBeUndefined();
    });
    expect(scoresOnList(result.reviews)?.["3"].score).toBe(6);
    expect(scoresOnList(result.reviews)?.average.score).toBe(6);

    finish({ "3": score("review-theirs", 6), average: score("average", 6) });
  });

  it("empties the score map when the removed score was the only one", async () => {
    const { handlers, finish } = scoredWork({
      [memberData.id]: score("review-mine", 10),
      average: score("average", 10),
    });
    const result = removeScore(handlers);

    await vi.waitFor(() => {
      expect(scoresOnList(result.reviews)?.[memberData.id]?.score).toBe(10);
    });

    result.remove.mutate({ reviewId: "review-mine", workId: "work-1" });

    // The server's own answer for a work nobody has scored, so the work reads
    // as unrated rather than as rated with an average of nothing.
    await vi.waitFor(() => {
      expect(scoresOnList(result.reviews)).toEqual({});
    });

    finish({});
  });
});

// ---------------------------------------------------------------------------
// useAddReviewComment (optimistic)
// ---------------------------------------------------------------------------

describe("useAddReviewComment", () => {
  it("puts the new comment on the thread", async () => {
    server.use(...commentsApi());

    const { result } = withSetup(withThread(() => useAddReviewComment("test-club", "work-1")));

    await vi.waitFor(() => {
      expect(contents(result.thread)).toEqual([]);
    });

    result.mutation.mutate({ content: "Loved it", spoiler: false });

    await vi.waitFor(() => {
      expect(contents(result.thread)).toEqual(["Loved it"]);
    });
  });
});

// ---------------------------------------------------------------------------
// useEditReviewComment (optimistic)
// ---------------------------------------------------------------------------

describe("useEditReviewComment", () => {
  it("rewrites the comment in place, spoiler flag included", async () => {
    server.use(...commentsApi([comment({ id: "c-7", content: "First thoughts" })]));

    const { result } = withSetup(withThread(() => useEditReviewComment("test-club", "work-1")));

    await vi.waitFor(() => {
      expect(contents(result.thread)).toEqual(["First thoughts"]);
    });

    result.mutation.mutate({ commentId: "c-7", content: "Edited", spoiler: true });

    await vi.waitFor(() => {
      expect(contents(result.thread)).toEqual(["Edited (spoiler)"]);
    });
  });
});

// ---------------------------------------------------------------------------
// useDeleteReviewComment (optimistic)
// ---------------------------------------------------------------------------

describe("useDeleteReviewComment", () => {
  it("takes only the named comment off the thread", async () => {
    server.use(
      ...commentsApi([
        comment({ id: "c-99", content: "Delete me" }),
        comment({ id: "c-100", content: "Keep me" }),
      ]),
    );

    const { result } = withSetup(withThread(() => useDeleteReviewComment("test-club", "work-1")));

    await vi.waitFor(() => {
      expect(contents(result.thread)).toEqual(["Delete me", "Keep me"]);
    });

    result.mutation.mutate("c-99");

    await vi.waitFor(() => {
      expect(contents(result.thread)).toEqual(["Keep me"]);
    });
  });
});
