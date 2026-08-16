import { http, HttpResponse } from "msw";

import { useDiscussionQuestions } from "../useDiscussionQuestions";
import { server } from "@/mocks/server";
import { withSetup } from "@/tests/utils";

describe("useDiscussionQuestions", () => {
  it("is disabled by default and does not fetch on mount", async () => {
    server.use(
      http.post("/api/club/:id/reviews/:workId/discussion-questions", () => {
        throw new Error("Questions cost a Gemini call, so nothing may ask for them on mount");
      }),
    );

    const { result } = withSetup(() => useDiscussionQuestions("test-club", "work-1"));

    await vi.waitFor(() => {
      expect(result.status.value).toBe("loading");
      expect(result.fetchStatus.value).toBe("idle");
    });
  });

  it("fetches questions when refetch() is called manually", async () => {
    server.use(
      http.post("/api/club/:id/reviews/:workId/discussion-questions", () =>
        HttpResponse.json({
          questions: ["What is the theme?", "Who is the hero?"],
        }),
      ),
    );

    const { result } = withSetup(() => useDiscussionQuestions("test-club", "work-1"));

    await result.refetch();

    expect(result.data.value).toEqual(["What is the theme?", "Who is the hero?"]);
  });

  it("does not retry on failure (retry: false)", async () => {
    let callCount = 0;
    server.use(
      http.post("/api/club/:id/reviews/:workId/discussion-questions", () => {
        callCount++;
        return new HttpResponse(null, { status: 500 });
      }),
    );

    const { result } = withSetup(() => useDiscussionQuestions("test-club", "work-1"));

    await result.refetch();

    expect(result.isError.value).toBe(true);
    expect(callCount).toBe(1);
  });
});
