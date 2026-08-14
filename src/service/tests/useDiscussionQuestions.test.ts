import { http, HttpResponse } from "msw";
import { defineComponent } from "vue";

import { useDiscussionQuestions } from "../useDiscussionQuestions";
import { server } from "@/mocks/server";
import { render } from "@/tests/utils";

describe("useDiscussionQuestions", () => {
  it("is disabled by default and does not fetch on mount", async () => {
    server.use(
      http.post("/api/club/:id/reviews/:workId/discussion-questions", () => {
        throw new Error("Questions cost a Gemini call, so nothing may ask for them on mount");
      }),
    );

    const Harness = defineComponent({
      setup() {
        const { status, fetchStatus } = useDiscussionQuestions("test-club", "work-1");
        return { status, fetchStatus };
      },
      template: `<div>{{ status }}/{{ fetchStatus }}</div>`,
    });

    const rendered = render(Harness);
    await rendered.findByText("loading/idle");
  });

  it("fetches questions when refetch() is called manually", async () => {
    server.use(
      http.post("/api/club/:id/reviews/:workId/discussion-questions", () =>
        HttpResponse.json({
          questions: ["What is the theme?", "Who is the hero?"],
        }),
      ),
    );

    const Harness = defineComponent({
      setup() {
        const { data, refetch, isSuccess } = useDiscussionQuestions("test-club", "work-1");
        return { data, refetch, isSuccess };
      },
      template: `<div><button @click="refetch()">fetch</button><span>{{ isSuccess ? data?.join('|') : 'idle' }}</span></div>`,
    });

    const rendered = render(Harness);
    rendered.getByRole("button").click();
    await rendered.findByText("What is the theme?|Who is the hero?");
  });

  it("does not retry on failure (retry: false)", async () => {
    let callCount = 0;
    server.use(
      http.post("/api/club/:id/reviews/:workId/discussion-questions", () => {
        callCount++;
        return new HttpResponse(null, { status: 500 });
      }),
    );

    const Harness = defineComponent({
      setup() {
        const { isError, refetch } = useDiscussionQuestions("test-club", "work-1");
        return { isError, refetch };
      },
      template: `<div><button @click="refetch()">fetch</button>{{ isError ? 'error' : 'ok' }}</div>`,
    });

    const rendered = render(Harness);
    rendered.getByRole("button").click();
    await rendered.findByText("error");
    // retry: false means exactly one attempt
    expect(callCount).toBe(1);
  });
});
