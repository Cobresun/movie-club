import { useQueryClient } from "@tanstack/vue-query";
import { http, HttpResponse } from "msw";
import { defineComponent } from "vue";

import {
  useAddReviewComment,
  useDeleteReviewComment,
  useEditReviewComment,
  useReviewComments,
  useSubmitScore,
} from "../useReviews";
import { server } from "@/mocks/server";
import { render } from "@/tests/utils";

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
      return { submit: useSubmitScore("test-club") };
    },
    template: `<button @click="() => submit(payload)">go</button>`,
  });

  it("POSTs to /api/club/:id/reviews when the work has no review yet", async () => {
    let capturedBody: unknown = null;
    server.use(
      http.post("/api/club/:id/reviews", async ({ request }) => {
        capturedBody = await request.json();
        return new HttpResponse(null, { status: 200 });
      }),
    );

    const rendered = render(Harness, { props: { payload: { workId: "work-1", score: 8 } } });
    rendered.getByRole("button").click();

    await vi.waitFor(() => expect(capturedBody).toMatchObject({ workId: "work-1", score: 8 }));
  });

  it("PUTs to /api/club/:id/reviews/:reviewId when a review already exists", async () => {
    let capturedBody: unknown = null;
    let capturedReviewId = "";
    server.use(
      http.put("/api/club/:id/reviews/:reviewId", async ({ request, params }) => {
        capturedReviewId = String(params.reviewId);
        capturedBody = await request.json();
        return new HttpResponse(null, { status: 200 });
      }),
    );

    const rendered = render(Harness, {
      props: { payload: { workId: "work-1", reviewId: "rev-42", score: 7 } },
    });
    rendered.getByRole("button").click();

    await vi.waitFor(() => expect(capturedReviewId).toBe("rev-42"));
    expect(capturedBody).toEqual({ score: 7 });
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
  it("POSTs comment to /api/club/:id/reviews/:workId/comments", async () => {
    let capturedBody: unknown = null;
    server.use(
      http.post("/api/club/:id/reviews/:workId/comments", async ({ request }) => {
        capturedBody = await request.json();
        return new HttpResponse(null, { status: 200 });
      }),
    );

    const Harness = defineComponent({
      setup() {
        const { mutate, isSuccess } = useAddReviewComment("test-club", "work-1");
        return { mutate, isSuccess };
      },
      template: `<button @click="() => mutate({ content: 'Loved it', spoiler: false })">{{ isSuccess ? 'done' : 'go' }}</button>`,
    });

    const rendered = render(Harness);
    rendered.getByRole("button").click();
    await rendered.findByText("done");
    expect(capturedBody).toEqual({ content: "Loved it", spoiler: false });
  });
});

// ---------------------------------------------------------------------------
// useEditReviewComment (optimistic)
// ---------------------------------------------------------------------------

describe("useEditReviewComment", () => {
  it("PUTs updated comment to /api/club/:id/reviews/:workId/comments/:commentId", async () => {
    let capturedBody: unknown = null;
    let capturedCommentId = "";
    server.use(
      http.put("/api/club/:id/reviews/:workId/comments/:commentId", async ({ request, params }) => {
        capturedCommentId = String(params.commentId);
        capturedBody = await request.json();
        return new HttpResponse(null, { status: 200 });
      }),
    );

    const Harness = defineComponent({
      setup() {
        const { mutate, isSuccess } = useEditReviewComment("test-club", "work-1");
        return { mutate, isSuccess };
      },
      template: `<button @click="() => mutate({ commentId: 'c-7', content: 'Edited', spoiler: true })">{{ isSuccess ? 'done' : 'go' }}</button>`,
    });

    const rendered = render(Harness);
    rendered.getByRole("button").click();
    await rendered.findByText("done");
    expect(capturedCommentId).toBe("c-7");
    expect(capturedBody).toEqual({ content: "Edited", spoiler: true });
  });
});

// ---------------------------------------------------------------------------
// useDeleteReviewComment (optimistic)
// ---------------------------------------------------------------------------

describe("useDeleteReviewComment", () => {
  it("DELETEs a comment by id", async () => {
    let deletedCommentId = "";
    server.use(
      http.delete("/api/club/:id/reviews/:workId/comments/:commentId", ({ params }) => {
        deletedCommentId = String(params.commentId);
        return new HttpResponse(null, { status: 200 });
      }),
    );

    const Harness = defineComponent({
      setup() {
        const { mutate, isSuccess } = useDeleteReviewComment("test-club", "work-1");
        return { mutate, isSuccess };
      },
      template: `<button @click="() => mutate('c-99')">{{ isSuccess ? 'done' : 'go' }}</button>`,
    });

    const rendered = render(Harness);
    rendered.getByRole("button").click();
    await rendered.findByText("done");
    expect(deletedCommentId).toBe("c-99");
  });
});
