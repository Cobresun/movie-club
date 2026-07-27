import { TestingPinia } from "@pinia/testing";
import { screen, waitFor } from "@testing-library/vue";
import { vi } from "vitest";

import ReviewScore from "../components/ReviewScore.vue";
import { ScoreAssistKey } from "../scoreAssist";
import memberData from "@/mocks/data/member.json";
import { useAuthStore } from "@/stores/auth";
import { render } from "@/tests/utils";

const ME = memberData.id;
const SOMEONE_ELSE = "999";

// useUser() reads the logged-in user straight from the auth store, so identity
// is established by populating authStore.user rather than a network response.
function asCurrentUser(pinia: TestingPinia) {
  const authStore = useAuthStore(pinia);
  // @ts-expect-error Overwriting readonly session user for testing purposes
  authStore.user = {
    id: memberData.id,
    email: memberData.email,
    name: memberData.name,
    image: memberData.image,
    createdAt: new Date(),
    updatedAt: new Date(),
    emailVerified: true,
  };
}

/** The Score Assist eligibility gate ReviewView provides to the panel. */
function withAssist(isEligible: boolean, open = vi.fn()) {
  return {
    global: { provide: { [ScoreAssistKey]: { isEligible: () => isEligible, open } } },
  };
}

describe("ReviewScore", () => {
  it("renders another member's score as plain text, with no trigger", async () => {
    const { pinia } = render(ReviewScore, {
      props: { memberId: SOMEONE_ELSE, workId: "w1", score: 8, editable: true },
    });
    asCurrentUser(pinia);

    expect(await screen.findByText("8")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });
  });

  it("renders the current user's score read-only where inline entry is disabled", async () => {
    const { pinia } = render(ReviewScore, {
      props: { memberId: ME, workId: "w1", score: 8, editable: false },
    });
    asCurrentUser(pinia);

    expect(await screen.findByText("8")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });
  });

  it("offers an 'Add score' trigger when the current user has not scored yet", async () => {
    const { pinia } = render(ReviewScore, {
      props: { memberId: ME, workId: "w1", editable: true },
    });
    asCurrentUser(pinia);

    const trigger = await screen.findByRole("button", { name: "Add score" });
    // The empty state reads as "+ /10" rather than a number.
    expect(trigger).toHaveTextContent("/10");
  });

  it("labels the trigger as an edit and shows the existing score", async () => {
    const { pinia } = render(ReviewScore, {
      props: { memberId: ME, workId: "w1", score: 7.5, editable: true },
    });
    asCurrentUser(pinia);

    const trigger = await screen.findByRole("button", { name: "Edit score" });
    expect(trigger).toHaveTextContent("7.5");
  });

  it("opens the score entry panel when the trigger is clicked", async () => {
    const { user, pinia } = render(ReviewScore, {
      props: { memberId: ME, workId: "w1", editable: true },
      ...withAssist(false),
    });
    asCurrentUser(pinia);

    await user.click(await screen.findByRole("button", { name: "Add score" }));

    expect(await screen.findByRole("spinbutton", { name: "Score" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save score" })).toBeInTheDocument();
  });

  it("hands the work off to the Score Assist flow and closes the popover", async () => {
    const open = vi.fn();
    const { user, pinia } = render(ReviewScore, {
      props: { memberId: ME, workId: "w1", editable: true },
      ...withAssist(true, open),
    });
    asCurrentUser(pinia);

    await user.click(await screen.findByRole("button", { name: "Add score" }));
    await user.click(await screen.findByRole("button", { name: /Not sure/ }));

    expect(open).toHaveBeenCalledWith("w1");
    // A popover cannot swap its own content, so it closes and the standalone
    // assist modal (hosted by ReviewView) takes over.
    await waitFor(() => {
      expect(screen.queryByRole("spinbutton", { name: "Score" })).not.toBeInTheDocument();
    });
  });
});
