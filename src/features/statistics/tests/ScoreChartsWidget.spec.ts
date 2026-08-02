import { screen } from "@testing-library/vue";

import ScoreChartsWidget from "../components/ScoreChartsWidget.vue";
import { makeHistogram, makeMember, makeMovie } from "./fixtures";
import { chartSeriesNames } from "@/mocks/agCharts";
import { mockIntersectionObserver } from "@/mocks/IntersectionObserver";
import { render } from "@/tests/utils";

vi.mock("ag-charts-vue3", async () => await import("@/mocks/agCharts"));

mockIntersectionObserver();

const members = [makeMember({ id: "m1", name: "Ada" }), makeMember({ id: "m2", name: "Alan" })];

const histogramData = makeHistogram(["m1", "m2"]);

// Both rolling charts use a window of at least five points, so a club needs six
// scored reviews before the Trend and Agreement tabs have anything to plot.
const workData = Array.from({ length: 6 }, (_unused, index) => {
  const createdDate = `2024-0${index + 1}-01T00:00:00.000Z`;
  const [adaScore, alanScore] = [8 - index, 4 + index];
  return makeMovie({
    id: String(index),
    title: `Movie ${index}`,
    createdDate,
    average: (adaScore + alanScore) / 2,
    userScores: { m1: adaScore, m2: alanScore },
    scores: {
      m1: { id: `s-m1-${index}`, created_date: createdDate, score: adaScore },
      m2: { id: `s-m2-${index}`, created_date: createdDate, score: alanScore },
    },
  });
});

const props = { workData, members, histogramData };

describe("ScoreChartsWidget", () => {
  it("opens on the score distribution", () => {
    render(ScoreChartsWidget, { props });

    expect(screen.getByRole("heading", { name: "Scores" })).toBeInTheDocument();
    expect(screen.getByText("How often each score gets handed out, by member")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Distribution" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("plots one histogram series per member", () => {
    render(ScoreChartsWidget, { props });

    expect(chartSeriesNames(screen.getByRole("img", { name: "chart" }))).toEqual(["Ada", "Alan"]);
  });

  it("switches to the rolling trend chart", async () => {
    const { user } = render(ScoreChartsWidget, { props });

    await user.click(screen.getByRole("tab", { name: "Trend" }));

    expect(screen.getByText("Rolling average score per member over time")).toBeInTheDocument();
    expect(chartSeriesNames(screen.getByRole("img", { name: "chart" }))).toEqual(["Ada", "Alan"]);
  });

  it("switches to the score spread chart", async () => {
    const { user } = render(ScoreChartsWidget, { props });

    await user.click(screen.getByRole("tab", { name: "Agreement" }));

    expect(
      screen.getByText("Rolling score spread — lower means more agreement"),
    ).toBeInTheDocument();
    expect(chartSeriesNames(screen.getByRole("img", { name: "chart" }))).not.toEqual([
      "Ada",
      "Alan",
    ]);
  });

  it("offers only the distribution tab when there is nothing to trend or spread", () => {
    render(ScoreChartsWidget, { props: { workData: [], members, histogramData } });

    expect(screen.getAllByRole("tab").map((tab) => tab.textContent?.trim())).toEqual([
      "Distribution",
    ]);
  });

  it("still renders a chart for a club with no reviews", () => {
    render(ScoreChartsWidget, { props: { workData: [], members, histogramData } });

    expect(screen.getByRole("img", { name: "chart" })).toBeInTheDocument();
  });
});
