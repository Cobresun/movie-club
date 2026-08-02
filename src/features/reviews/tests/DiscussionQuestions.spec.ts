import { screen } from "@testing-library/vue";
import { delay, http, HttpResponse } from "msw";

import DiscussionQuestions from "../components/DiscussionQuestions.vue";
import { mockIntersectionObserver } from "@/mocks/IntersectionObserver";
import { server } from "@/mocks/server";
import { render } from "@/tests/utils";

mockIntersectionObserver();

const props = { clubSlug: "test-club", workId: "work-1", mediaNoun: "movie" };

const questionsHandler = (questions: string[]) =>
  http.post("/api/club/:id/reviews/:workId/discussion-questions", () =>
    HttpResponse.json({ questions }),
  );

describe("DiscussionQuestions", () => {
  it("offers to generate questions before anything has been fetched", () => {
    render(DiscussionQuestions, { props });

    expect(
      screen.getByRole("button", { name: /Generate discussion questions/ }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Discussion questions")).not.toBeInTheDocument();
  });

  it("lists the generated questions in order", async () => {
    server.use(questionsHandler(["What is the theme?", "Who is the hero?"]));
    const { user } = render(DiscussionQuestions, { props });

    await user.click(screen.getByRole("button", { name: /Generate discussion questions/ }));

    expect(await screen.findByText("What is the theme?")).toBeInTheDocument();
    expect(screen.getByText("Who is the hero?")).toBeInTheDocument();
    expect(screen.getByText("Discussion questions")).toBeInTheDocument();
    const numbers = screen.getAllByText(/^\d\.$/).map((el) => el.textContent);
    expect(numbers).toEqual(["1.", "2."]);
  });

  it("swaps the prompt for a regenerate control once questions exist", async () => {
    server.use(questionsHandler(["Only question"]));
    const { user } = render(DiscussionQuestions, { props });

    await user.click(screen.getByRole("button", { name: /Generate discussion questions/ }));

    expect(await screen.findByRole("button", { name: "Regenerate" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Generate discussion questions/ }),
    ).not.toBeInTheDocument();
  });

  it("replaces the questions when regenerated", async () => {
    server.use(questionsHandler(["First pass"]));
    const { user } = render(DiscussionQuestions, { props });

    await user.click(screen.getByRole("button", { name: /Generate discussion questions/ }));
    await screen.findByText("First pass");

    server.use(questionsHandler(["Second pass"]));
    await user.click(screen.getByRole("button", { name: "Regenerate" }));

    expect(await screen.findByText("Second pass")).toBeInTheDocument();
    expect(screen.queryByText("First pass")).not.toBeInTheDocument();
  });

  it("explains that the work could not be recognized when the model returns nothing", async () => {
    server.use(questionsHandler([]));
    const { user } = render(DiscussionQuestions, { props });

    await user.click(screen.getByRole("button", { name: /Generate discussion questions/ }));

    expect(
      await screen.findByText(
        /We couldn't recognize this movie, so we couldn't generate discussion questions/,
      ),
    ).toBeInTheDocument();
  });

  it("uses the club's own media noun in the unrecognized message", async () => {
    server.use(questionsHandler([]));
    const { user } = render(DiscussionQuestions, { props: { ...props, mediaNoun: "book" } });

    await user.click(screen.getByRole("button", { name: /Generate discussion questions/ }));

    expect(await screen.findByText(/We couldn't recognize this book/)).toBeInTheDocument();
  });

  it("shows a disabled progress label while a request is in flight", async () => {
    server.use(
      http.post("/api/club/:id/reviews/:workId/discussion-questions", async () => {
        await delay(50);
        return HttpResponse.json({ questions: ["Eventually"] });
      }),
    );
    const { user } = render(DiscussionQuestions, { props });

    await user.click(screen.getByRole("button", { name: /Generate discussion questions/ }));

    const generating = await screen.findByRole("button", { name: /Generating questions…/ });
    expect(generating).toBeDisabled();
    expect(await screen.findByText("Eventually")).toBeInTheDocument();
  });

  it("offers a retry when the request fails", async () => {
    server.use(
      http.post(
        "/api/club/:id/reviews/:workId/discussion-questions",
        () => new HttpResponse(null, { status: 500 }),
      ),
    );
    const { user } = render(DiscussionQuestions, { props });

    await user.click(screen.getByRole("button", { name: /Generate discussion questions/ }));

    expect(
      await screen.findByText("Couldn't generate questions. Please try again."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Try again/ })).toBeInTheDocument();
  });

  it("recovers from a failure on retry", async () => {
    server.use(
      http.post(
        "/api/club/:id/reviews/:workId/discussion-questions",
        () => new HttpResponse(null, { status: 500 }),
      ),
    );
    const { user } = render(DiscussionQuestions, { props });

    await user.click(screen.getByRole("button", { name: /Generate discussion questions/ }));
    await screen.findByRole("button", { name: /Try again/ });

    server.use(questionsHandler(["Recovered question"]));
    await user.click(screen.getByRole("button", { name: /Try again/ }));

    expect(await screen.findByText("Recovered question")).toBeInTheDocument();
  });

  it("keeps the previous questions and warns when a regenerate fails", async () => {
    server.use(questionsHandler(["Original question"]));
    const { user } = render(DiscussionQuestions, { props });

    await user.click(screen.getByRole("button", { name: /Generate discussion questions/ }));
    await screen.findByText("Original question");

    server.use(
      http.post(
        "/api/club/:id/reviews/:workId/discussion-questions",
        () => new HttpResponse(null, { status: 500 }),
      ),
    );
    await user.click(screen.getByRole("button", { name: "Regenerate" }));

    expect(
      await screen.findByText("Couldn't regenerate. Showing the previous questions."),
    ).toBeInTheDocument();
    expect(screen.getByText("Original question")).toBeInTheDocument();
  });
});
