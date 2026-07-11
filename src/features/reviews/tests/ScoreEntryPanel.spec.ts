import { screen, waitFor } from "@testing-library/vue";
import { http, HttpResponse } from "msw";
import { vi } from "vitest";

import ScoreEntryPanel from "../components/ScoreEntryPanel.vue";
import { ScoreAssistKey } from "../scoreAssist";

import { mockIntersectionObserver } from "@/mocks/IntersectionObserver";
import { server } from "@/mocks/server";
import { render } from "@/tests/utils";

mockIntersectionObserver();

/** Provide a Score Assist stub so the assist button's gating can be exercised. */
function withAssist(isEligible: boolean) {
  return {
    global: {
      provide: {
        [ScoreAssistKey]: { isEligible: () => isEligible, open: vi.fn() },
      },
    },
  };
}

describe("ScoreEntryPanel", () => {
  it("renders the score field and disables Save until a value is entered", async () => {
    const { user } = render(ScoreEntryPanel, { props: { workId: "target" } });

    expect(
      screen.getByRole("spinbutton", { name: "Score" }),
    ).toBeInTheDocument();

    const save = screen.getByRole("button", { name: "Save score" });
    expect(save).toBeDisabled();

    await user.type(screen.getByRole("spinbutton", { name: "Score" }), "8.5");
    expect(save).toBeEnabled();
    expect(screen.getByText("Great")).toBeInTheDocument();
  });

  it("shows the verdict band for a prefilled score", () => {
    render(ScoreEntryPanel, {
      props: { workId: "target", reviewId: "rev1", score: 4.4 },
    });

    expect(screen.getByRole("spinbutton", { name: "Score" })).toHaveValue(4.4);
    expect(screen.getByText("Meh")).toBeInTheDocument();
  });

  it("clamps typed scores above the max and explains the clamp", async () => {
    const { user } = render(ScoreEntryPanel, { props: { workId: "target" } });

    const input = screen.getByRole("spinbutton", { name: "Score" });
    await user.type(input, "12");

    expect(input).toHaveValue(10);
    expect(screen.getByText("Max is 10 — set to 10.0")).toBeInTheDocument();
  });

  it("creates a new score via POST and emits submit", async () => {
    let posted: unknown;
    server.use(
      http.post("/api/club/test-club/reviews", async ({ request }) => {
        posted = await request.json();
        return HttpResponse.json({});
      }),
    );

    const rendered = render(ScoreEntryPanel, { props: { workId: "target" } });
    const { user } = rendered;

    await user.type(screen.getByRole("spinbutton", { name: "Score" }), "8.5");
    await user.click(screen.getByRole("button", { name: "Save score" }));

    await waitFor(() =>
      expect(posted).toEqual({ workId: "target", score: 8.5 }),
    );
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
      props: { workId: "target", reviewId: "rev1", score: 6 },
    });

    const input = screen.getByRole("spinbutton", { name: "Score" });
    expect(input).toHaveValue(6);
    await user.clear(input);
    await user.type(input, "7");
    await user.click(screen.getByRole("button", { name: "Save score" }));

    await waitFor(() => expect(put).toEqual({ score: 7 }));
  });

  it("re-seeds the field when the score prop changes out from under it", async () => {
    // Mirrors returning from Score Assist: the saved suggestion flows in as a new
    // `score` prop, and the (mount-seeded) field must follow it rather than keep
    // the pre-assist value.
    const rendered = render(ScoreEntryPanel, {
      props: { workId: "target", reviewId: "rev1", score: 6 },
    });

    const input = screen.getByRole("spinbutton", { name: "Score" });
    expect(input).toHaveValue(6);

    await rendered.rerender({ workId: "target", reviewId: "rev1", score: 8 });
    expect(input).toHaveValue(8);
  });

  it("emits assist from the labeled button when eligible", async () => {
    // The panel doesn't open the flow itself: the host decides whether to swap
    // its own overlay content or open the standalone modal.
    const rendered = render(ScoreEntryPanel, {
      props: { workId: "target" },
      ...withAssist(true),
    });
    const { user } = rendered;

    const assist = await screen.findByRole("button", {
      name: /Compare .* you've rated/,
    });
    await user.click(assist);
    expect(rendered.emitted().assist).toHaveLength(1);
  });

  it("hides the assist button when the user is not eligible", () => {
    render(ScoreEntryPanel, {
      props: { workId: "target" },
      ...withAssist(false),
    });

    expect(
      screen.queryByRole("button", { name: /Compare .* you've rated/ }),
    ).not.toBeInTheDocument();
  });
});
