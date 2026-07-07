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
function withAssist(isEligible: boolean, open = vi.fn()) {
  return {
    global: {
      provide: { [ScoreAssistKey]: { isEligible: () => isEligible, open } },
    },
  };
}

describe("ScoreEntryPanel", () => {
  it("renders the score field and disables Save until a value is entered", async () => {
    const { user } = render(ScoreEntryPanel, { props: { workId: "target" } });

    expect(
      screen.getByRole("spinbutton", { name: "Score" }),
    ).toBeInTheDocument();
    expect(screen.getByText("/10")).toBeInTheDocument();

    const save = screen.getByRole("button", { name: "Save score" });
    expect(save).toBeDisabled();

    await user.type(screen.getByRole("spinbutton", { name: "Score" }), "8.5");
    expect(save).toBeEnabled();
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

  it("opens Score Assist from the labeled button when eligible", async () => {
    const open = vi.fn();
    const { user } = render(ScoreEntryPanel, {
      props: { workId: "target" },
      ...withAssist(true, open),
    });

    const assist = await screen.findByRole("button", {
      name: /Compare .* you've rated/,
    });
    await user.click(assist);
    expect(open).toHaveBeenCalledWith("target");
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
