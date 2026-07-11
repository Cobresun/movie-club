import { TestingPinia } from "@pinia/testing";
import { screen, waitFor } from "@testing-library/vue";
import { http, HttpResponse } from "msw";
import { vi } from "vitest";

import { WorkType } from "../../../../lib/types/generated/db";
import { DetailedReviewListItem } from "../../../../lib/types/lists";
import ScoreEntryModal from "../components/ScoreEntryModal.vue";
import { ScoreAssistKey } from "../scoreAssist";

import memberData from "@/mocks/data/member.json";
import { mockIntersectionObserver } from "@/mocks/IntersectionObserver";
import { server } from "@/mocks/server";
import { useAuthStore } from "@/stores/auth";
import { render } from "@/tests/utils";

mockIntersectionObserver();

function makeTarget(): DetailedReviewListItem {
  return {
    id: "target",
    type: WorkType.movie,
    title: "Target Movie",
    createdDate: "2024-01-01",
    scores: {},
  };
}

/** A work the mock user has scored, for the assist candidate pool. */
function scoredReview(id: string, score: number) {
  return {
    id,
    title: `Movie ${id}`,
    createdDate: "2024-05-28T04:46:37.751Z",
    type: "movie",
    scores: {
      [memberData.id]: {
        id: `review-${id}`,
        created_date: "2024-05-28T04:46:37.751Z",
        score,
      },
    },
  };
}

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

/** Provide the Score Assist eligibility gate the entry panel reads. */
function withAssist(isEligible: boolean) {
  return {
    global: {
      provide: {
        [ScoreAssistKey]: { isEligible: () => isEligible, open: vi.fn() },
      },
    },
  };
}

describe("ScoreEntryModal", () => {
  it("shows the dial for the target work and closes after saving", async () => {
    let posted: unknown;
    server.use(
      http.post("/api/club/test-club/reviews", async ({ request }) => {
        posted = await request.json();
        return HttpResponse.json({});
      }),
    );

    const rendered = render(ScoreEntryModal, {
      props: { target: makeTarget() },
      ...withAssist(false),
    });
    const { user } = rendered;

    expect(screen.getByText("Target Movie")).toBeInTheDocument();

    await user.type(screen.getByRole("spinbutton", { name: "Score" }), "8.5");
    await user.click(screen.getByRole("button", { name: "Save score" }));

    await waitFor(() =>
      expect(posted).toEqual({ workId: "target", score: 8.5 }),
    );
    expect(rendered.emitted().close).toHaveLength(1);
  });

  it("swaps to the assist flow in place instead of stacking a second overlay", async () => {
    server.use(
      http.get("/api/club/:clubSlug/list/reviews", () =>
        HttpResponse.json(
          [2, 3, 4, 5, 6, 7].map((n) => scoredReview(`m${n}`, n)),
        ),
      ),
      http.post("/api/club/test-club/reviews", () => HttpResponse.json({})),
    );

    const rendered = render(ScoreEntryModal, {
      props: { target: makeTarget() },
      ...withAssist(true),
    });
    const { user, pinia } = rendered;
    logIn(pinia);

    await user.click(
      await screen.findByRole("button", { name: /Compare .* you've rated/ }),
    );

    // The dial gave way to the comparison flow inside the same overlay.
    expect(
      await screen.findByText("Which movie did you like more?"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Save score" }),
    ).not.toBeInTheDocument();

    // Finishing the flow saves immediately and closes the whole modal, not
    // just the assist layer.
    await user.click(screen.getByRole("button", { name: "Too close to call" }));
    await waitFor(() => expect(rendered.emitted().close).toHaveLength(1));
  });
});
