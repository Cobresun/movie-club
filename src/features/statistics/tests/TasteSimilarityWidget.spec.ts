import { screen } from "@testing-library/vue";

import TasteSimilarityWidget from "../components/TasteSimilarityWidget.vue";
import { makeMember, makeMovie } from "./fixtures";
import { mockIntersectionObserver } from "@/mocks/IntersectionObserver";
import { render } from "@/tests/utils";

mockIntersectionObserver();

const members = [
  makeMember({ id: "m1", name: "Ada Lovelace" }),
  makeMember({ id: "m2", name: "Alan Turing" }),
  makeMember({ id: "m3", name: "Grace Hopper" }),
];

// Ada and Alan score identically; Grace disagrees with both by a wide margin.
// Three shared reviews is the minimum a pair needs to be compared at all.
const workData = [
  makeMovie({ id: "1", title: "Agreed On", userScores: { m1: 8, m2: 8, m3: 1 } }),
  makeMovie({ id: "2", title: "Also Agreed", userScores: { m1: 7, m2: 7, m3: 2 } }),
  makeMovie({ id: "3", title: "Agreed Again", userScores: { m1: 9, m2: 9, m3: 3 } }),
];

const props = { workData, members };

describe("TasteSimilarityWidget", () => {
  it("opens on the closest-matching pair", () => {
    render(TasteSimilarityWidget, { props });

    expect(screen.getByRole("heading", { name: "Taste Similarity" })).toBeInTheDocument();
    expect(screen.getByText("The pair whose scores line up the closest")).toBeInTheDocument();
    expect(screen.getByText("Ada")).toBeInTheDocument();
    expect(screen.getByText("Alan")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("reports the pair's average gap and how many reviews it is based on", () => {
    render(TasteSimilarityWidget, { props });

    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getByText(/points across 3 shared reviews/)).toBeInTheDocument();
  });

  it("lists the pair's top agreements with both scores", () => {
    render(TasteSimilarityWidget, { props });

    expect(screen.getByText("Top agreements")).toBeInTheDocument();
    expect(screen.getByText("Agreed On")).toBeInTheDocument();
    expect(screen.getByText("8 vs 8")).toBeInTheDocument();
  });

  it("switches to the pair whose scores clash hardest", async () => {
    const { user } = render(TasteSimilarityWidget, { props });

    await user.click(screen.getByRole("tab", { name: "Least Similar" }));

    expect(screen.getByText("The pair whose scores clash the hardest")).toBeInTheDocument();
    expect(screen.getByText("Grace")).toBeInTheDocument();
    expect(screen.getByText("40%")).toBeInTheDocument();
    expect(screen.getByText("Biggest disagreements")).toBeInTheDocument();
  });

  it("shows the widest gaps first in the least-similar view", async () => {
    const { user } = render(TasteSimilarityWidget, { props });

    await user.click(screen.getByRole("tab", { name: "Least Similar" }));

    expect(screen.getByText("8 vs 1")).toBeInTheDocument();
    expect(screen.getByText("9 vs 3")).toBeInTheDocument();
  });

  it("renders nothing when no pair shares the three-review minimum", () => {
    render(TasteSimilarityWidget, {
      props: { members, workData: [workData[0], workData[1]] },
    });

    expect(screen.queryByText("Taste Similarity")).not.toBeInTheDocument();
  });

  it("renders nothing for a club with a single member", () => {
    render(TasteSimilarityWidget, { props: { workData, members: [members[0]] } });

    expect(screen.queryByText("Taste Similarity")).not.toBeInTheDocument();
  });

  it("renders nothing for a club with no reviews", () => {
    render(TasteSimilarityWidget, { props: { members, workData: [] } });

    expect(screen.queryByText("Taste Similarity")).not.toBeInTheDocument();
  });
});
