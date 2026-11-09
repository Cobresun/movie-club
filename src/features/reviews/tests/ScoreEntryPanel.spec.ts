import { screen, waitFor } from "@testing-library/vue";
import { http, HttpResponse } from "msw";

import { WorkType } from "../../../../lib/types/generated/db";
import { type MemberScoredWork } from "../../../../lib/types/lists";
import ScoreEntryPanel from "../components/ScoreEntryPanel.vue";
import { ScoreAssistKey } from "../scoreAssist";
import { mockIntersectionObserver } from "@/mocks/IntersectionObserver";
import { server } from "@/mocks/server";
import { logIn, render } from "@/tests/utils";

mockIntersectionObserver();

const TARGET = { id: "target", type: WorkType.MOVIE };

/** A score the mock user gave in some club; the test club's id is "1". */
function memberScore(overrides: Partial<MemberScoredWork>): MemberScoredWork {
  return {
    workId: "other-work",
    clubId: "2",
    clubName: "Friday Films",
    clubSlug: "friday-films",
    type: WorkType.MOVIE,
    title: "Dune",
    externalId: "438631",
    score: 7.5,
    scoredDate: "2024-05-28T04:46:37.751Z",
    ...overrides,
  };
}

function withMemberScores(scores: MemberScoredWork[]) {
  server.use(http.get("/api/member/scores", () => HttpResponse.json<MemberScoredWork[]>(scores)));
}

/** Provide a Score Assist stub so the assist button's gating can be exercised. */
function withAssist(isEligible: boolean) {
  return {
    global: {
      provide: {
        [ScoreAssistKey]: { isEligible: () => isEligible, open: vi.fn<() => void>() },
      },
    },
  };
}

describe("ScoreEntryPanel", () => {
  it("renders the score field and disables Save until a value is entered", async () => {
    const { user } = render(ScoreEntryPanel, { props: { work: TARGET } });

    expect(screen.getByRole("spinbutton", { name: "Score" })).toBeInTheDocument();

    const save = screen.getByRole("button", { name: "Save score" });
    expect(save).toBeDisabled();

    await user.type(screen.getByRole("spinbutton", { name: "Score" }), "8.5");
    expect(save).toBeEnabled();
    expect(screen.getByText("Great")).toBeInTheDocument();
  });

  it("shows the verdict band for a prefilled score", () => {
    render(ScoreEntryPanel, {
      props: { work: TARGET, reviewId: "rev1", score: 4.4 },
    });

    expect(screen.getByRole("spinbutton", { name: "Score" })).toHaveValue(4.4);
    expect(screen.getByText("Meh")).toBeInTheDocument();
  });

  it("clamps typed scores above the max, explains it, and shakes the input", async () => {
    const { user } = render(ScoreEntryPanel, { props: { work: TARGET } });

    const input = screen.getByRole("spinbutton", { name: "Score" });
    await user.type(input, "12");

    expect(input).toHaveValue(10);
    expect(screen.getByText("Max is 10 — set to 10.0")).toBeInTheDocument();
    expect(input).toHaveClass("score-shake");
  });

  it("truncates typing beyond two decimals and shakes the input", async () => {
    const { user } = render(ScoreEntryPanel, { props: { work: TARGET } });

    const input = screen.getByRole("spinbutton", { name: "Score" });
    await user.type(input, "8.555");

    expect(input).toHaveValue(8.55);
    expect(input).toHaveClass("score-shake");
  });

  it("creates a new score via POST and emits submit", async () => {
    let posted: unknown;
    server.use(
      http.post("/api/club/test-club/reviews", async ({ request }) => {
        posted = await request.json();
        return HttpResponse.json({});
      }),
    );

    const rendered = render(ScoreEntryPanel, { props: { work: TARGET } });
    const { user } = rendered;

    await user.type(screen.getByRole("spinbutton", { name: "Score" }), "8.5");
    await user.click(screen.getByRole("button", { name: "Save score" }));

    await waitFor(() => {
      expect(posted).toStrictEqual({ workId: "target", score: 8.5 });
    });
    expect(rendered.emitted().submit).toHaveLength(1);
  });

  it("updates an existing review via PUT, prefilled with the current score", async () => {
    let put: unknown;
    server.use(
      http.put("/api/club/test-club/reviews/rev1", async ({ request }) => {
        put = await request.json();
        return HttpResponse.json({});
      }),
    );

    const { user } = render(ScoreEntryPanel, {
      props: { work: TARGET, reviewId: "rev1", score: 6 },
    });

    const input = screen.getByRole("spinbutton", { name: "Score" });
    expect(input).toHaveValue(6);
    await user.clear(input);
    await user.type(input, "7");
    await user.click(screen.getByRole("button", { name: "Save score" }));

    await waitFor(() => {
      expect(put).toStrictEqual({ score: 7 });
    });
  });

  it("autofocuses a prefilled field with the caret at the end, not selecting it", async () => {
    // Asserted through the calls rather than `selectionStart`: jsdom reports a
    // null caret for `type="number"` and resets the selection when the field
    // flips back from text, so the placement itself is unobservable here.
    const setSelectionRange = vi.spyOn(HTMLInputElement.prototype, "setSelectionRange");
    const select = vi.spyOn(HTMLInputElement.prototype, "select");

    render(ScoreEntryPanel, {
      props: { work: TARGET, reviewId: "rev1", score: 8.5, autofocus: true },
    });

    const input = screen.getByRole("spinbutton", { name: "Score" });
    await waitFor(() => {
      expect(input).toHaveFocus();
    });

    // "8.5" — caret past the last character, so a keystroke appends instead of
    // replacing the whole score.
    expect(setSelectionRange).toHaveBeenCalledWith(3, 3);
    expect(select).not.toHaveBeenCalled();
  });

  it("re-seeds the field when the score prop changes out from under it", async () => {
    // Mirrors returning from Score Assist: the saved suggestion flows in as a new
    // `score` prop, and the (mount-seeded) field must follow it rather than keep
    // the pre-assist value.
    const rendered = render(ScoreEntryPanel, {
      props: { work: TARGET, reviewId: "rev1", score: 6 },
    });

    const input = screen.getByRole("spinbutton", { name: "Score" });
    expect(input).toHaveValue(6);

    await rendered.rerender({ work: TARGET, reviewId: "rev1", score: 8 });
    expect(input).toHaveValue(8);
  });

  it("offers no removal until a score has actually been saved", () => {
    render(ScoreEntryPanel, { props: { work: TARGET } });

    expect(screen.queryByRole("button", { name: "Remove my score" })).not.toBeInTheDocument();
  });

  it("deletes an existing score once the inline confirm is accepted", async () => {
    let deleted = false;
    server.use(
      http.delete("/api/club/test-club/reviews/rev1", () => {
        deleted = true;
        return HttpResponse.json({});
      }),
    );

    const rendered = render(ScoreEntryPanel, {
      props: { work: TARGET, reviewId: "rev1", score: 6 },
    });
    const { user } = rendered;

    await user.click(screen.getByRole("button", { name: "Remove my score" }));
    expect(screen.getByText(/Remove your score\?/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() => {
      expect(deleted).toBe(true);
    });
    // The panel closes without the saved-score animation.
    expect(rendered.emitted().submit).toHaveLength(1);
    expect(rendered.emitted().saved).toBeUndefined();
  });

  it("sends nothing when the removal confirm is dismissed", async () => {
    let deleted = false;
    server.use(
      http.delete("/api/club/test-club/reviews/rev1", () => {
        deleted = true;
        return HttpResponse.json({});
      }),
    );

    const rendered = render(ScoreEntryPanel, {
      props: { work: TARGET, reviewId: "rev1", score: 6 },
    });
    const { user } = rendered;

    await user.click(screen.getByRole("button", { name: "Remove my score" }));
    await user.click(screen.getByRole("button", { name: "Keep it" }));

    expect(screen.getByRole("button", { name: "Remove my score" })).toBeInTheDocument();
    expect(deleted).toBe(false);
    expect(rendered.emitted().submit).toBeUndefined();
  });

  it("emits assist from the labeled button when eligible", async () => {
    // The panel doesn't open the flow itself: the host decides whether to swap
    // its own overlay content or open the standalone modal.
    const rendered = render(ScoreEntryPanel, {
      props: { work: TARGET },
      ...withAssist(true),
    });
    const { user } = rendered;

    const assist = await screen.findByRole("button", {
      name: /Compare to decide/u,
    });
    await user.click(assist);
    expect(rendered.emitted().assist).toHaveLength(1);
  });

  describe("copying a score from another club", () => {
    const DUNE = { id: "target", type: WorkType.MOVIE, externalId: "438631" };

    it("fills the dial with the score the user gave the same work in another club", async () => {
      withMemberScores([memberScore({})]);
      const { user, pinia } = render(ScoreEntryPanel, { props: { work: DUNE } });
      logIn(pinia);

      await user.click(
        await screen.findByRole("button", { name: "Use your 7.5 from Friday Films" }),
      );

      expect(screen.getByRole("spinbutton", { name: "Score" })).toHaveValue(7.5);
      expect(screen.getByRole("button", { name: "Save score" })).toBeEnabled();
    });

    it("offers each other club's score, most recent first", async () => {
      withMemberScores([
        memberScore({ clubId: "2", clubName: "Friday Films", score: 7.5 }),
        memberScore({
          clubId: "3",
          clubName: "Work Club",
          score: 9,
          scoredDate: "2025-01-01T00:00:00.000Z",
        }),
      ]);
      const { pinia } = render(ScoreEntryPanel, { props: { work: DUNE } });
      logIn(pinia);

      const offers = await screen.findAllByRole("button", { name: /^Use your/u });
      expect(offers.map((offer) => offer.textContent?.trim())).toStrictEqual([
        "Use your 9 from Work Club",
        "Use your 7.5 from Friday Films",
      ]);
    });

    it("ignores this club's own score, other works, and other media", async () => {
      withMemberScores([
        memberScore({ clubId: "1", clubName: "Test club", workId: "target" }),
        memberScore({ externalId: "999" }),
        memberScore({ type: WorkType.TV }),
        memberScore({ clubId: "3", clubName: "Work Club", score: 6 }),
      ]);
      const { pinia } = render(ScoreEntryPanel, { props: { work: DUNE } });
      logIn(pinia);

      expect(
        await screen.findByRole("button", { name: "Use your 6 from Work Club" }),
      ).toBeInTheDocument();
      expect(screen.getAllByRole("button", { name: /^Use your/u })).toHaveLength(1);
    });

    it("leaves out a score that already matches the one saved here", async () => {
      withMemberScores([
        memberScore({ score: 7.5 }),
        memberScore({ clubId: "3", clubName: "Work Club", score: 6 }),
      ]);
      const { pinia } = render(ScoreEntryPanel, {
        props: { work: DUNE, reviewId: "rev1", score: 7.5 },
      });
      logIn(pinia);

      await screen.findByRole("button", { name: "Use your 6 from Work Club" });
      expect(
        screen.queryByRole("button", { name: "Use your 7.5 from Friday Films" }),
      ).not.toBeInTheDocument();
    });

    it("offers nothing for a work with no external id to match on", async () => {
      withMemberScores([memberScore({ externalId: undefined })]);
      const { pinia } = render(ScoreEntryPanel, {
        props: { work: { id: "target", type: WorkType.MOVIE } },
      });
      logIn(pinia);

      await waitFor(() => {
        expect(screen.getByRole("spinbutton", { name: "Score" })).toBeInTheDocument();
      });
      expect(screen.queryByRole("button", { name: /^Use your/u })).not.toBeInTheDocument();
    });
  });

  it("hides the assist button when the user is not eligible", () => {
    render(ScoreEntryPanel, {
      props: { work: TARGET },
      ...withAssist(false),
    });

    expect(screen.queryByRole("button", { name: /Compare to decide/u })).not.toBeInTheDocument();
  });
});
