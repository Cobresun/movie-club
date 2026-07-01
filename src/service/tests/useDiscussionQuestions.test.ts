import { http, HttpResponse } from "msw";
import { defineComponent } from "vue";

import { useDiscussionQuestions } from "../useDiscussionQuestions";

import { server } from "@/mocks/server";
import { render } from "@/tests/utils";

describe("useDiscussionQuestions", () => {
  it("is disabled by default and does not fetch on mount", async () => {
    let fetchCalled = false;
    server.use(
      http.post("/api/club/:id/reviews/:workId/discussion-questions", () => {
        fetchCalled = true;
        return HttpResponse.json({ questions: ["Q1", "Q2"] });
      }),
    );

    const Harness = defineComponent({
      setup() {
        const { isLoading, isFetching, data } = useDiscussionQuestions(
          "test-club",
          "work-1",
        );
        return { isLoading, isFetching, data };
      },
      template: `<div>{{ isFetching ? 'fetching' : 'idle' }}</div>`,
    });

    render(Harness);
    await new Promise((r) => setTimeout(r, 80));
    expect(fetchCalled).toBe(false);
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
        const { data, refetch, isSuccess } = useDiscussionQuestions(
          "test-club",
          "work-1",
        );
        return { data, refetch, isSuccess };
      },
      template: `<div><button @click="refetch()">fetch</button><span>{{ isSuccess ? data?.join('|') : 'idle' }}</span></div>`,
    });

    const { getByRole, findByText } = render(Harness);
    getByRole("button").click();
    await findByText("What is the theme?|Who is the hero?");
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
        const { isError, refetch } = useDiscussionQuestions(
          "test-club",
          "work-1",
        );
        return { isError, refetch };
      },
      template: `<div><button @click="refetch()">fetch</button>{{ isError ? 'error' : 'ok' }}</div>`,
    });

    const { getByRole, findByText } = render(Harness);
    getByRole("button").click();
    await findByText("error");
    // retry: false means exactly one attempt
    expect(callCount).toBe(1);
  });
});
