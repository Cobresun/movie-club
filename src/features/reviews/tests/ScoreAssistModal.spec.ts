import { TestingPinia } from "@pinia/testing";
import { screen, waitFor } from "@testing-library/vue";
import { http, HttpResponse } from "msw";

import { ClubType, WorkType } from "../../../../lib/types/generated/db";
import { DetailedReviewListItem, Review } from "../../../../lib/types/lists";
import ScoreAssistModal from "../components/ScoreAssistModal.vue";
import { ScoredCandidate } from "../composables/scoreAssistLogic";

import memberData from "@/mocks/data/member.json";
import { mockIntersectionObserver } from "@/mocks/IntersectionObserver";
import { server } from "@/mocks/server";
import { useAuthStore } from "@/stores/auth";
import { render } from "@/tests/utils";

mockIntersectionObserver();

function makeTarget(
  scores: Record<string, Review> = {},
): DetailedReviewListItem {
  return {
    id: "target",
    type: WorkType.movie,
    title: "Target Movie",
    createdDate: "2024-01-01",
    scores,
  };
}

// Scores 1..5: the first pivot is Movie 4 (rank-middle window 2/3/4, closest
// to the initial 0-10 midpoint), per the deterministic selection rules.
const candidates: ScoredCandidate[] = [1, 2, 3, 4, 5].map((n) => ({
  workId: `w${n}`,
  title: `Movie ${n}`,
  score: n,
}));

function logIn(pinia: TestingPinia) {
  const authStore = useAuthStore(pinia);
  // @ts-expect-error Overwriting readonly property for testing purposes
  authStore.user = {
    id: memberData.id,
    email: memberData.email,
    name: memberData.name,
    image: memberData.image,
    createdAt: new Date(),
    updatedAt: new Date(),
    emailVerified: true,
  };
  // @ts-expect-error Forcing logged in to true for testing
  authStore.isLoggedIn = true;
}

describe("ScoreAssistModal", () => {
  it("asks the comparison question with the club-type noun", () => {
    render(ScoreAssistModal, {
      props: { target: makeTarget(), candidates, clubType: ClubType.movie },
    });
    expect(
      screen.getByText("Which movie did you like more?"),
    ).toBeInTheDocument();
    expect(screen.getByText("Comparison 1 of up to 5")).toBeInTheDocument();
  });

  it("uses the book noun for book clubs", () => {
    render(ScoreAssistModal, {
      props: { target: makeTarget(), candidates, clubType: ClubType.book },
    });
    expect(
      screen.getByText("Which book did you like more?"),
    ).toBeInTheDocument();
  });

  it("converges to an editable suggestion after repeated comparisons", async () => {
    const { user } = render(ScoreAssistModal, {
      props: { target: makeTarget(), candidates, clubType: ClubType.movie },
    });

    // Beat Movie 4, then Movie 5 (the top): aboveAll -> 5 + 0.5.
    await user.click(
      screen.getByRole("button", { name: "I liked Target Movie more" }),
    );
    await user.click(
      screen.getByRole("button", { name: "I liked Target Movie more" }),
    );

    const input = screen.getByRole("spinbutton", { name: "Score" });
    expect(input).toHaveValue(5.5);
    expect(
      screen.getByText(/Higher than Movie 5 \(5\) — your top-rated movie/),
    ).toBeInTheDocument();
  });

  it("jumps straight to the pivot's score on 'too close to call'", async () => {
    const { user } = render(ScoreAssistModal, {
      props: { target: makeTarget(), candidates, clubType: ClubType.movie },
    });

    await user.click(screen.getByRole("button", { name: "Too close to call" }));

    expect(screen.getByRole("spinbutton", { name: "Score" })).toHaveValue(4);
    expect(
      screen.getByText(/About the same as Movie 4 \(4\)/),
    ).toBeInTheDocument();
  });

  it("saves a new score with POST, honoring the user's edits", async () => {
    let postedBody: unknown;
    server.use(
      http.post("/api/club/test-club/reviews", async ({ request }) => {
        postedBody = await request.json();
        return HttpResponse.json({});
      }),
    );

    const rendered = render(ScoreAssistModal, {
      props: { target: makeTarget(), candidates, clubType: ClubType.movie },
    });
    const { user, pinia } = rendered;
    logIn(pinia);

    await user.click(screen.getByRole("button", { name: "Too close to call" }));
    const input = screen.getByRole("spinbutton", { name: "Score" });
    await user.clear(input);
    await user.type(input, "7.5");
    await user.click(screen.getByRole("button", { name: "Save score" }));

    await waitFor(() =>
      expect(postedBody).toEqual({ workId: "target", score: 7.5 }),
    );
    expect(rendered.emitted().close).toHaveLength(1);
  });

  it("updates an existing review with PUT", async () => {
    let putBody: unknown;
    server.use(
      http.put(
        "/api/club/test-club/reviews/review-target",
        async ({ request }) => {
          putBody = await request.json();
          return HttpResponse.json({});
        },
      ),
    );

    const target = makeTarget({
      [memberData.id]: {
        id: "review-target",
        created_date: "2024-01-01",
        score: 6,
      },
    });
    const rendered = render(ScoreAssistModal, {
      props: { target, candidates, clubType: ClubType.movie },
    });
    const { user, pinia } = rendered;
    logIn(pinia);

    await user.click(screen.getByRole("button", { name: "Too close to call" }));
    await user.click(screen.getByRole("button", { name: "Save score" }));

    await waitFor(() => expect(putBody).toEqual({ score: 4 }));
    expect(rendered.emitted().close).toHaveLength(1);
  });

  it("starts over with a fresh comparison", async () => {
    const { user } = render(ScoreAssistModal, {
      props: { target: makeTarget(), candidates, clubType: ClubType.movie },
    });

    await user.click(screen.getByRole("button", { name: "Too close to call" }));
    expect(screen.getByRole("spinbutton", { name: "Score" })).toHaveValue(4);

    await user.click(screen.getByRole("button", { name: "Start over" }));
    expect(
      screen.getByText("Which movie did you like more?"),
    ).toBeInTheDocument();
    expect(screen.getByText("Comparison 1 of up to 5")).toBeInTheDocument();
  });
});
