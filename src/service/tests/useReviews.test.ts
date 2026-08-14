import { useQueryClient } from "@tanstack/vue-query";
import { http, HttpResponse } from "msw";
import { defineComponent } from "vue";

import { useReviewsList } from "../useList";
import {
  useAddReviewComment,
  useDeleteReviewComment,
  useEditReviewComment,
  useReviewComments,
  useSubmitScore,
} from "../useReviews";
import { server } from "@/mocks/server";
import { render } from "@/tests/utils";

/** Renders the thread as text, so a comment's content and spoiler flag show. */
const THREAD = `{{ thread?.map((c) => c.spoiler ? c.content + ' (spoiler)' : c.content).join(', ') || 'empty' }}`;

function comment(id: string, content: string, spoiler = false) {
  return {
    id,
    workId: "work-1",
    userId: "u-1",
    userName: "Alice",
    content,
    createdDate: "2024-01-01T00:00:00.000Z",
    spoiler,
  };
}

/** A comment thread that keeps what the mutations send it. */
function commentsApi(initial: ReturnType<typeof comment>[] = []) {
  let thread = [...initial];
  const base = "/api/club/:id/reviews/:workId/comments";

  return [
    http.get(base, () => HttpResponse.json(thread)),
    http.post(base, async ({ request }) => {
      const { content, spoiler } = (await request.json()) as { content: string; spoiler: boolean };
      thread = [...thread, comment(`c-${thread.length + 1}`, content, spoiler)];
      return HttpResponse.json({});
    }),
    http.put(`${base}/:commentId`, async ({ request, params }) => {
      const { content, spoiler } = (await request.json()) as { content: string; spoiler: boolean };
      thread = thread.map((existing) =>
        existing.id === params.commentId ? { ...existing, content, spoiler } : existing,
      );
      return HttpResponse.json({});
    }),
    http.delete(`${base}/:commentId`, ({ params }) => {
      thread = thread.filter((existing) => existing.id !== params.commentId);
      return HttpResponse.json({});
    }),
  ];
}

// ---------------------------------------------------------------------------
// useSubmitScore
//
// The create and update mutations it picks between are module-private, so both
// paths are driven through this — the surface ReviewScore, ScoreEntryPanel and
// ScoreAssistModal actually call.
// ---------------------------------------------------------------------------

describe("useSubmitScore", () => {
  const Harness = defineComponent({
    props: { payload: { type: Object, required: true } },
    setup() {
      const { data: reviews } = useReviewsList("test-club");
      return { submit: useSubmitScore("test-club"), reviews };
    },
    template: `<button @click="() => submit(payload)">{{ reviews?.[0]?.scores["u-1"]?.score ?? 'unscored' }}</button>`,
  });

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

  it("scores a work that has no review yet", async () => {
    server.use(...reviewedWork());

    const rendered = render(Harness, { props: { payload: { workId: "work-1", score: 8 } } });
    await rendered.findByRole("button", { name: "unscored" });

    rendered.getByRole("button").click();

    await rendered.findByRole("button", { name: "8" });
  });

  it("replaces the score on a work that is already reviewed", async () => {
    server.use(...reviewedWork({ reviewId: "rev-42", score: 5 }));

    const rendered = render(Harness, {
      props: { payload: { workId: "work-1", reviewId: "rev-42", score: 7 } },
    });
    await rendered.findByRole("button", { name: "5" });

    rendered.getByRole("button").click();

    await rendered.findByRole("button", { name: "7" });
  });
});

// ---------------------------------------------------------------------------
// useReviewComments
// ---------------------------------------------------------------------------

describe("useReviewComments", () => {
  it("fetches comments from /api/club/:id/reviews/:workId/comments", async () => {
    server.use(
      http.get("/api/club/:id/reviews/:workId/comments", () =>
        HttpResponse.json([
          {
            id: "c-1",
            workId: "work-1",
            userId: "u-1",
            userName: "Alice",
            content: "Great film!",
            createdDate: "2024-01-01T00:00:00.000Z",
            spoiler: false,
          },
        ]),
      ),
    );

    const Harness = defineComponent({
      setup() {
        const { data, isSuccess } = useReviewComments("test-club", "work-1");
        return { data, isSuccess };
      },
      template: `<div>{{ isSuccess ? data?.[0]?.content : 'loading' }}</div>`,
    });

    const rendered = render(Harness);
    await rendered.findByText("Great film!");
  });

  it("propagates errors when comments fetch fails", async () => {
    server.use(
      http.get(
        "/api/club/:id/reviews/:workId/comments",
        () => new HttpResponse(null, { status: 403 }),
      ),
    );

    const Harness = defineComponent({
      setup() {
        // Disable retries so the error surfaces immediately instead of after
        // 3 retries with exponential backoff (~7 s total by default).
        useQueryClient().setDefaultOptions({ queries: { retry: false } });
        const { isError } = useReviewComments("test-club", "work-1");
        return { isError };
      },
      template: `<div>{{ isError ? 'error' : 'ok' }}</div>`,
    });

    const rendered = render(Harness);
    await rendered.findByText("error");
  });
});

// ---------------------------------------------------------------------------
// useAddReviewComment (optimistic)
// ---------------------------------------------------------------------------

describe("useAddReviewComment", () => {
  it("puts the new comment on the thread", async () => {
    server.use(...commentsApi());

    const Harness = defineComponent({
      setup() {
        const { mutate } = useAddReviewComment("test-club", "work-1");
        const { data: thread } = useReviewComments("test-club", "work-1");
        return { mutate, thread };
      },
      template: `<button @click="() => mutate({ content: 'Loved it', spoiler: false })">${THREAD}</button>`,
    });

    const rendered = render(Harness);
    await rendered.findByRole("button", { name: "empty" });

    rendered.getByRole("button").click();

    await rendered.findByRole("button", { name: "Loved it" });
  });
});

// ---------------------------------------------------------------------------
// useEditReviewComment (optimistic)
// ---------------------------------------------------------------------------

describe("useEditReviewComment", () => {
  it("rewrites the comment in place, spoiler flag included", async () => {
    server.use(...commentsApi([comment("c-7", "First thoughts")]));

    const Harness = defineComponent({
      setup() {
        const { mutate } = useEditReviewComment("test-club", "work-1");
        const { data: thread } = useReviewComments("test-club", "work-1");
        return { mutate, thread };
      },
      template: `<button @click="() => mutate({ commentId: 'c-7', content: 'Edited', spoiler: true })">${THREAD}</button>`,
    });

    const rendered = render(Harness);
    await rendered.findByRole("button", { name: "First thoughts" });

    rendered.getByRole("button").click();

    await rendered.findByRole("button", { name: "Edited (spoiler)" });
  });
});

// ---------------------------------------------------------------------------
// useDeleteReviewComment (optimistic)
// ---------------------------------------------------------------------------

describe("useDeleteReviewComment", () => {
  it("takes only the named comment off the thread", async () => {
    server.use(...commentsApi([comment("c-99", "Delete me"), comment("c-100", "Keep me")]));

    const Harness = defineComponent({
      setup() {
        const { mutate } = useDeleteReviewComment("test-club", "work-1");
        const { data: thread } = useReviewComments("test-club", "work-1");
        return { mutate, thread };
      },
      template: `<button @click="() => mutate('c-99')">${THREAD}</button>`,
    });

    const rendered = render(Harness);
    await rendered.findByRole("button", { name: "Delete me, Keep me" });

    rendered.getByRole("button").click();

    await rendered.findByRole("button", { name: "Keep me" });
  });
});
