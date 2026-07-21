import { TestingPinia } from "@pinia/testing";
import { screen, waitFor } from "@testing-library/vue";
import { http, HttpResponse } from "msw";
import { vi } from "vitest";

import { WorkType } from "../../../../lib/types/generated/db";
import { DetailedReviewListItem } from "../../../../lib/types/lists";
import ScoreEntryDock from "../components/ScoreEntryDock.vue";
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

describe("ScoreEntryDock", () => {
  it("expands from the CTA, saves the score, and collapses back", async () => {
    let posted: unknown;
    server.use(
      http.post("/api/club/test-club/reviews", async ({ request }) => {
        posted = await request.json();
        return HttpResponse.json({});
      }),
    );

    const { user } = render(ScoreEntryDock, {
      props: { target: makeTarget() },
      ...withAssist(false),
    });

    // Collapsed: only the CTA is accessible; the panel is aria-hidden.
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Rate this movie/ }));

    await user.type(
      await screen.findByRole("spinbutton", { name: "Score" }),
      "8.5",
    );
    await user.click(screen.getByRole("button", { name: "Save score" }));

    await waitFor(() =>
      expect(posted).toEqual({ workId: "target", score: 8.5 }),
    );

    // Saving collapses the panel and restores the CTA.
    await waitFor(() =>
      expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument(),
    );
    expect(
      screen.getByRole("button", { name: /Rate this movie/ }),
    ).toBeInTheDocument();
  });

  it("labels the CTA as an edit when the user already has a review", () => {
    render(ScoreEntryDock, {
      props: { target: makeTarget(), score: 7, reviewId: "review-1" },
      ...withAssist(false),
    });

    expect(
      screen.getByRole("button", { name: /Edit score/ }),
    ).toBeInTheDocument();
  });

  it("swaps to the assist flow in place and prefills the dial with its suggestion", async () => {
    let posted: unknown;
    server.use(
      http.get("/api/club/:clubSlug/list/reviews", () =>
        HttpResponse.json(
          [2, 3, 4, 5, 6, 7].map((n) => scoredReview(`m${n}`, n)),
        ),
      ),
      http.post("/api/club/test-club/reviews", async ({ request }) => {
        posted = await request.json();
        return HttpResponse.json({});
      }),
    );

    const { user, pinia } = render(ScoreEntryDock, {
      props: { target: makeTarget() },
      ...withAssist(true),
    });
    logIn(pinia);

    await user.click(screen.getByRole("button", { name: /Rate this movie/ }));
    await user.click(
      await screen.findByRole("button", { name: /Compare to decide/ }),
    );

    // The dial gave way to the comparison flow inside the same panel.
    expect(
      await screen.findByText("Which movie did you like more?"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();

    // Finishing the flow swaps back to the dial pre-filled with the
    // suggestion (the first pivot's score, 5) — nothing is saved yet.
    await user.click(screen.getByRole("button", { name: "Too close to call" }));
    expect(
      await screen.findByRole("spinbutton", { name: "Score" }),
    ).toHaveValue(5);
    expect(posted).toBeUndefined();

    // Saving is still the user's call; it persists and collapses the dock
    // back to the CTA.
    await user.click(screen.getByRole("button", { name: "Save score" }));
    await waitFor(() => expect(posted).toEqual({ workId: "target", score: 5 }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /Rate this movie/ }),
      ).toBeInTheDocument(),
    );
  });

  it("collapses on Escape without letting the event reach the drawer", async () => {
    const drawerEscape = vi.fn();
    window.addEventListener("keydown", drawerEscape);

    const { user } = render(ScoreEntryDock, {
      props: { target: makeTarget() },
      ...withAssist(false),
    });

    await user.click(screen.getByRole("button", { name: /Rate this movie/ }));
    expect(
      await screen.findByRole("spinbutton", { name: "Score" }),
    ).toBeInTheDocument();

    await user.keyboard("{Escape}");

    await waitFor(() =>
      expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument(),
    );
    expect(
      screen.getByRole("button", { name: /Rate this movie/ }),
    ).toBeInTheDocument();
    // The capture-phase handler stopped propagation, so a bubble-phase
    // listener (VSideDrawer's close-on-escape) never saw the key.
    expect(drawerEscape).not.toHaveBeenCalled();

    window.removeEventListener("keydown", drawerEscape);
  });
});
