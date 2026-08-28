import { screen, waitFor } from "@testing-library/vue";
import { http, HttpResponse } from "msw";
import { vi } from "vitest";

import { WorkType } from "../../../../lib/types/generated/db";
import { DetailedReviewListItem } from "../../../../lib/types/lists";
import ScoreEntryModal from "../components/ScoreEntryModal.vue";
import { ScoreAssistKey } from "../scoreAssist";
import { mockIntersectionObserver } from "@/mocks/IntersectionObserver";
import { server } from "@/mocks/server";
import { logIn, render } from "@/tests/utils";

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

    await waitFor(() => expect(posted).toEqual({ workId: "target", score: 8.5 }));
    expect(rendered.emitted().close).toHaveLength(1);
  });

  it("swaps to the assist flow in place instead of stacking a second overlay", async () => {
    let posted: unknown;
    server.use(
      http.get("/api/member/scores", () =>
        HttpResponse.json([2, 3, 4, 5, 6, 7].map((n) => memberScore(`m${n}`, n))),
      ),
      http.post("/api/club/test-club/reviews", async ({ request }) => {
        posted = await request.json();
        return HttpResponse.json({});
      }),
    );

    const rendered = render(ScoreEntryModal, {
      props: { target: makeTarget() },
      ...withAssist(true),
    });
    const { user, pinia } = rendered;
    logIn(pinia);

    await user.click(await screen.findByRole("button", { name: /Compare to decide/ }));

    // The dial gave way to the comparison flow inside the same overlay.
    expect(await screen.findByText("Which movie did you like more?")).toBeInTheDocument();
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save score" })).not.toBeInTheDocument();

    // Finishing the flow swaps back to the dial pre-filled with the
    // suggestion (the first pivot's score, 5); the modal stays open and
    // nothing is saved until the user says so.
    await user.click(screen.getByRole("button", { name: "Too close to call" }));
    expect(await screen.findByRole("spinbutton", { name: "Score" })).toHaveValue(5);
    expect(posted).toBeUndefined();
    expect(rendered.emitted().close).toBeUndefined();

    await user.click(screen.getByRole("button", { name: "Save score" }));
    await waitFor(() => expect(posted).toEqual({ workId: "target", score: 5 }));
    expect(rendered.emitted().close).toHaveLength(1);
  });
});
