import { screen } from "@testing-library/vue";

import { Member } from "../../../../lib/types/club";
import { WorkType } from "../../../../lib/types/generated/db";
import TasteSimilarityWidget from "../components/TasteSimilarityWidget.vue";
import type { BookData } from "../types";
import { mockIntersectionObserver } from "@/mocks/IntersectionObserver";
import { render } from "@/tests/utils";

mockIntersectionObserver();

const members: Member[] = [
  { id: "m1", name: "Ann Adams", email: "ann@example.com" },
  { id: "m2", name: "Bo Baker", email: "bo@example.com" },
  { id: "m3", name: "Cal Chan", email: "cal@example.com" },
];

// Ann/Bo differ by 1 (90%), Ann/Cal by 4 (60%), Bo/Cal by 5 (50%).
const scoresByWork: Record<string, number>[] = [
  { m1: 6, m2: 7, m3: 2 },
  { m1: 7, m2: 8, m3: 3 },
  { m1: 5, m2: 6, m3: 1 },
];

const workData: BookData[] = scoresByWork.map((userScores, index) => ({
  id: `b${index}`,
  type: WorkType.book,
  title: `Book ${index}`,
  createdDate: "2024-01-01T00:00:00.000Z",
  externalId: undefined,
  imageUrl: undefined,
  average: 5,
  userScores,
  scores: {},
  dateWatched: "1/1/2024",
}));

/** The two names flanking the similarity percentage, in render order. */
function pairLabels(): string[] {
  return screen
    .getAllByText(/.+/, { selector: "span.mt-1" })
    .map((element) => element.textContent ?? "");
}

describe("TasteSimilarityWidget", () => {
  it("shows the club-wide pair and no scope toggle for a signed-out viewer", () => {
    render(TasteSimilarityWidget, { props: { workData, members } });

    expect(screen.queryByRole("tab", { name: "You" })).not.toBeInTheDocument();
    expect(screen.getByText("90%")).toBeInTheDocument();
    expect(screen.getByText("Ann")).toBeInTheDocument();
    expect(screen.getByText("Bo")).toBeInTheDocument();
  });

  it("hides the scope toggle when the viewer is not a club member", () => {
    render(TasteSimilarityWidget, {
      props: { workData, members, currentUserId: "outsider" },
    });

    expect(screen.queryByRole("tab", { name: "You" })).not.toBeInTheDocument();
  });

  it("scopes to the signed-in member's own pairs", async () => {
    const { user } = render(TasteSimilarityWidget, {
      props: { workData, members, currentUserId: "m3" },
    });

    // Defaults to the club-wide view.
    expect(screen.getByText("90%")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "You" }));

    // Cal's closest is Ann at 60%, even though Ann's own closest is Bo.
    expect(screen.getByText("60%")).toBeInTheDocument();
    expect(pairLabels()).toEqual(["You", "Ann"]);
    expect(
      screen.getByText("The member whose scores line up closest with yours"),
    ).toBeInTheDocument();
  });

  it("keeps the mode selection when switching scope", async () => {
    const { user } = render(TasteSimilarityWidget, {
      props: { workData, members, currentUserId: "m3" },
    });

    await user.click(screen.getByRole("tab", { name: "Least Similar" }));
    expect(screen.getByText("50%")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "You" }));

    // Cal's furthest is Bo at 50% — same number here, so assert on the pair.
    expect(pairLabels()).toEqual(["You", "Bo"]);
  });
});
