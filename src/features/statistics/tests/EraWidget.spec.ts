import { screen } from "@testing-library/vue";

import { ClubType } from "../../../../lib/types/generated/db";
import EraWidget from "../components/EraWidget.vue";
import { makeBook, makeExternalBook, makeExternalMovie, makeMember, makeMovie } from "./fixtures";
import { chartOptions } from "@/mocks/agCharts";
import { mockIntersectionObserver } from "@/mocks/IntersectionObserver";
import { render } from "@/tests/utils";

vi.mock("ag-charts-vue3", async () => await import("@/mocks/agCharts"));

mockIntersectionObserver();

const members = [makeMember({ id: "m1", name: "Ada" }), makeMember({ id: "m2", name: "Alan" })];

const movies = [
  makeMovie({
    id: "1",
    average: 8,
    userScores: { m1: 10, m2: 6 },
    externalData: makeExternalMovie({ release_date: "1994-09-10" }),
  }),
  makeMovie({
    id: "2",
    average: 6,
    userScores: { m1: 2, m2: 10 },
    externalData: makeExternalMovie({ release_date: "2015-05-15" }),
  }),
];

/** The decade rows the widget handed to the chart, as `[decade, average]`. */
function plottedDecades(): [string, number][] {
  const data: unknown = chartOptions(screen.getByRole("img", { name: "chart" })).data;
  if (!Array.isArray(data)) return [];
  return data.map((row: { decade: string; averageScore: number }) => [
    row.decade,
    row.averageScore,
  ]);
}

describe("EraWidget", () => {
  it("charts a movie club's release decades", () => {
    render(EraWidget, { props: { workData: movies, members, clubType: ClubType.movie } });

    expect(screen.getByRole("heading", { name: "Through the Years" })).toBeInTheDocument();
    expect(screen.getByText("Average score by release decade")).toBeInTheDocument();
    expect(plottedDecades()).toEqual([
      ["1990s", 8],
      ["2010s", 6],
    ]);
  });

  it("charts a book club's publication decades instead", () => {
    render(EraWidget, {
      props: {
        workData: [
          makeBook({
            id: "b1",
            average: 9,
            externalData: makeExternalBook({ firstPublishYear: 1965 }),
          }),
        ],
        members,
        clubType: ClubType.book,
      },
    });

    expect(screen.getByText("Average score by publication decade")).toBeInTheDocument();
    expect(plottedDecades()).toEqual([["1960s", 9]]);
  });

  it("charts the club average until a member is picked", () => {
    render(EraWidget, { props: { workData: movies, members, clubType: ClubType.movie } });

    expect(screen.getByRole("button", { name: "All" })).toHaveClass("bg-primary");
  });

  it("recharts using one member's own scores when their chip is picked", async () => {
    const { user } = render(EraWidget, {
      props: { workData: movies, members, clubType: ClubType.movie },
    });

    await user.click(screen.getByRole("button", { name: /Ada/ }));

    expect(plottedDecades()).toEqual([
      ["1990s", 10],
      ["2010s", 2],
    ]);
  });

  it("returns to the club average when All is picked again", async () => {
    const { user } = render(EraWidget, {
      props: { workData: movies, members, clubType: ClubType.movie },
    });

    await user.click(screen.getByRole("button", { name: /Alan/ }));
    expect(plottedDecades()).toEqual([
      ["1990s", 6],
      ["2010s", 10],
    ]);

    await user.click(screen.getByRole("button", { name: "All" }));
    expect(plottedDecades()).toEqual([
      ["1990s", 8],
      ["2010s", 6],
    ]);
  });

  it("renders nothing when no work carries a release date", () => {
    render(EraWidget, {
      props: {
        workData: [makeMovie({ externalData: makeExternalMovie({ release_date: "" }) })],
        members,
        clubType: ClubType.movie,
      },
    });

    expect(screen.queryByText("Through the Years")).not.toBeInTheDocument();
  });

  it("renders nothing for a club with no reviews", () => {
    render(EraWidget, { props: { workData: [], members, clubType: ClubType.movie } });

    expect(screen.queryByText("Through the Years")).not.toBeInTheDocument();
  });

  it("ignores movie metadata in a book club and vice versa", () => {
    // A movie in a book club has no publish year, so there is nothing to chart.
    render(EraWidget, { props: { workData: movies, members, clubType: ClubType.book } });

    expect(screen.queryByText("Through the Years")).not.toBeInTheDocument();
  });
});
