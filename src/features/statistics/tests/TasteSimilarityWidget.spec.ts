import { screen } from "@testing-library/vue";

import { Member } from "../../../../lib/types/club";
import { WorkType } from "../../../../lib/types/generated/db";
import TasteSimilarityWidget from "../components/TasteSimilarityWidget.vue";
import type { BookData } from "../types";
import { makeMember, makeMovie } from "./fixtures";
import { mockIntersectionObserver } from "@/mocks/IntersectionObserver";
import { render } from "@/tests/utils";

mockIntersectionObserver();

// ─── Scope fixtures ───────────────────────────────────────────────────────────
// Drive the club-wide vs "You" scope toggle. Book works, so the widget is
// exercised for a club type that has no poster/TMDB data.

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

// ─── Presentation fixtures ────────────────────────────────────────────────────
// A clean two-agree/one-disagree split, for the copy, gap figures and the
// agreement/disagreement lists.

const pairMembers = [
  makeMember({ id: "m1", name: "Ada Lovelace" }),
  makeMember({ id: "m2", name: "Alan Turing" }),
  makeMember({ id: "m3", name: "Grace Hopper" }),
];

// Ada and Alan score identically; Grace disagrees with both by a wide margin.
// Three shared reviews is the minimum a pair needs to be compared at all.
const pairWorkData = [
  makeMovie({ id: "1", title: "Agreed On", userScores: { m1: 8, m2: 8, m3: 1 } }),
  makeMovie({ id: "2", title: "Also Agreed", userScores: { m1: 7, m2: 7, m3: 2 } }),
  makeMovie({ id: "3", title: "Agreed Again", userScores: { m1: 9, m2: 9, m3: 3 } }),
];

const pairProps = { workData: pairWorkData, members: pairMembers };

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

  it("opens on the closest-matching pair", () => {
    render(TasteSimilarityWidget, { props: pairProps });

    expect(screen.getByRole("heading", { name: "Taste Similarity" })).toBeInTheDocument();
    expect(screen.getByText("The pair whose scores line up the closest")).toBeInTheDocument();
    expect(screen.getByText("Ada")).toBeInTheDocument();
    expect(screen.getByText("Alan")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("reports the pair's average gap and how many reviews it is based on", () => {
    render(TasteSimilarityWidget, { props: pairProps });

    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getByText(/points across 3 shared reviews/)).toBeInTheDocument();
  });

  it("lists the pair's top agreements with both scores", () => {
    render(TasteSimilarityWidget, { props: pairProps });

    expect(screen.getByText("Top agreements")).toBeInTheDocument();
    expect(screen.getByText("Agreed On")).toBeInTheDocument();
    expect(screen.getByText("8 vs 8")).toBeInTheDocument();
  });

  it("switches to the pair whose scores clash hardest", async () => {
    const { user } = render(TasteSimilarityWidget, { props: pairProps });

    await user.click(screen.getByRole("tab", { name: "Least Similar" }));

    expect(screen.getByText("The pair whose scores clash the hardest")).toBeInTheDocument();
    expect(screen.getByText("Grace")).toBeInTheDocument();
    expect(screen.getByText("40%")).toBeInTheDocument();
    expect(screen.getByText("Biggest disagreements")).toBeInTheDocument();
  });

  it("shows the widest gaps first in the least-similar view", async () => {
    const { user } = render(TasteSimilarityWidget, { props: pairProps });

    await user.click(screen.getByRole("tab", { name: "Least Similar" }));

    expect(screen.getByText("8 vs 1")).toBeInTheDocument();
    expect(screen.getByText("9 vs 3")).toBeInTheDocument();
  });

  it("renders nothing when no pair shares the three-review minimum", () => {
    render(TasteSimilarityWidget, {
      props: { members: pairMembers, workData: [pairWorkData[0], pairWorkData[1]] },
    });

    expect(screen.queryByText("Taste Similarity")).not.toBeInTheDocument();
  });

  it("renders nothing for a club with a single member", () => {
    render(TasteSimilarityWidget, {
      props: { workData: pairWorkData, members: [pairMembers[0]] },
    });

    expect(screen.queryByText("Taste Similarity")).not.toBeInTheDocument();
  });

  it("renders nothing for a club with no reviews", () => {
    render(TasteSimilarityWidget, { props: { members: pairMembers, workData: [] } });

    expect(screen.queryByText("Taste Similarity")).not.toBeInTheDocument();
  });
});
