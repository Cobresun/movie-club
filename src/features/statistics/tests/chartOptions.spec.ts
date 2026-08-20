import type { AgCartesianChartOptions } from "ag-charts-community";

import { WorkType } from "../../../../lib/types/generated/db";
import {
  createCumulativeCountChartOptions,
  createHistogramOptions,
  createMonthlyActivityChartOptions,
} from "../scoring";
import type { HistogramData, MovieData } from "../types";

/**
 * ag-charts' options are wide unions that TypeScript cannot narrow from a
 * property read, and the codebase forbids `as` casts — so these runtime
 * predicates do the narrowing (the convention noted in testing.md).
 */
interface NamedSeries {
  yKey: string;
  yName?: string;
  // ag-charts widens `fill` to a gradient union; the tests only compare
  // identity, so keep it opaque rather than fighting the union.
  fill?: unknown;
  stacked?: boolean;
  type: string;
}

function isNamedSeries(series: unknown): series is NamedSeries {
  return typeof series === "object" && series !== null && "yKey" in series;
}

function seriesOf(options: AgCartesianChartOptions): NamedSeries[] {
  // Widen first: the declared element union has members without `yKey`, so
  // filtering the typed array cannot narrow to NamedSeries.
  const series: unknown[] = options.series ?? [];
  return series.filter(isNamedSeries);
}

interface TitledAxis {
  type: string;
  position?: string;
  min?: number;
  max?: number;
  title?: { enabled?: boolean; text?: string };
  label?: { fontSize?: number };
}

function isTitledAxis(axis: unknown): axis is TitledAxis {
  return typeof axis === "object" && axis !== null && "type" in axis;
}

function axisAt(options: AgCartesianChartOptions, position: string): TitledAxis | undefined {
  const axes: unknown[] = options.axes ?? [];
  return axes.filter(isTitledAxis).find((axis) => axis.position === position);
}

// ─── fixtures ─────────────────────────────────────────────────────────────────

const members = [
  { id: "1", email: "dev@test.com", name: "dev" },
  { id: "2", email: "user@test.com", name: "user" },
];

const emptyBins: HistogramData[] = Array.from({ length: 11 }, (_, bin) => ({ bin }));

function work(id: string, userScores: Record<string, number>): MovieData {
  return {
    id,
    title: id,
    createdDate: "2024-05-01T00:00:00.000Z",
    externalId: id,
    imageUrl: undefined,
    average: 8,
    userScores,
    scores: {},
    dateWatched: "May 1, 2024",
    type: WorkType.movie,
    genres: [],
    production_companies: [],
    production_countries: [],
    externalData: {
      kind: "movie",
      castNames: [],
      majorCastNames: [],
      directors: [],
      genres: [],
      production_companies: [],
      production_countries: [],
    },
  };
}

// ─── createHistogramOptions ───────────────────────────────────────────────────

describe("createHistogramOptions", () => {
  const params = {
    filteredWorkData: [work("a", { "1": 8, "2": 6 }), work("b", { "1": 8.6 })],
    histogramData: emptyBins,
    members,
    compact: false,
  };

  it("draws one stacked series per member, named for the legend", () => {
    const series = seriesOf(createHistogramOptions(params));

    expect(series.map((s) => s.yName)).toEqual(["dev", "user"]);
    expect(series.every((s) => s.stacked === true)).toBe(true);
  });

  it("gives each member a distinct colour, matching their slot in the palette", () => {
    const fills = seriesOf(createHistogramOptions(params)).map((s) => s.fill);

    expect(new Set(fills).size).toBe(2);
  });

  it("recounts the bins from the filtered works rather than the passed-in totals", () => {
    const options = createHistogramOptions(params);
    const data = options.data ?? [];

    // dev scored 8 and 8.6 — both floor into bin 8; user scored a single 6.
    expect(data[8]).toMatchObject({ "1": 2, "2": 0 });
    expect(data[6]).toMatchObject({ "1": 0, "2": 1 });
  });

  it("zeroes every bin when the member filter excludes all works", () => {
    const options = createHistogramOptions({ ...params, filteredWorkData: [] });
    const data = options.data ?? [];

    expect(data.every((bin: Record<string, number>) => bin["1"] === 0 && bin["2"] === 0)).toBe(
      true,
    );
  });

  it("labels both axes at full size", () => {
    const options = createHistogramOptions(params);

    expect(axisAt(options, "bottom")?.title).toMatchObject({ enabled: true, text: "Score" });
    expect(axisAt(options, "left")?.title).toMatchObject({ enabled: true, text: "Reviews" });
  });

  it("drops the axis titles and shrinks labels in compact mode", () => {
    const options = createHistogramOptions({ ...params, compact: true });

    expect(axisAt(options, "bottom")?.title?.enabled).toBe(false);
    expect(Number(axisAt(options, "bottom")?.label?.fontSize)).toBeLessThan(
      Number(axisAt(createHistogramOptions(params), "bottom")?.label?.fontSize),
    );
  });
});

// ─── activity charts ──────────────────────────────────────────────────────────

describe("createMonthlyActivityChartOptions", () => {
  const points = [{ month: new Date("2024-03-01T00:00:00Z"), label: "Mar 2024", count: 3 }];

  it("names the series with the club's own count label", () => {
    const [series] = seriesOf(createMonthlyActivityChartOptions(points, "Books read"));

    expect(series?.yName).toBe("Books read");
  });

  it("titles the count axis with the same label", () => {
    const options = createMonthlyActivityChartOptions(points, "Movies watched");

    expect(axisAt(options, "left")?.title).toMatchObject({ text: "Movies watched" });
  });

  it("plots months on a time axis so gaps in activity stay visible", () => {
    expect(
      axisAt(createMonthlyActivityChartOptions(points, "Movies watched"), "bottom")?.type,
    ).toBe("time");
  });
});

describe("createCumulativeCountChartOptions", () => {
  const points = [
    { date: new Date("2024-01-05T00:00:00Z"), title: "Inception", total: 1 },
    { date: new Date("2024-02-05T00:00:00Z"), title: "Dune", total: 2 },
  ];

  it("draws a running total as a line", () => {
    const [series] = seriesOf(createCumulativeCountChartOptions(points, "Movies watched"));

    expect(series?.type).toBe("line");
    expect(series?.yKey).toBe("total");
  });

  it("starts the count axis at zero", () => {
    const options = createCumulativeCountChartOptions(points, "Movies watched");

    expect(axisAt(options, "left")?.min).toBe(0);
  });

  it("carries the club's count label onto the axis", () => {
    const options = createCumulativeCountChartOptions(points, "Books read");

    expect(axisAt(options, "left")?.title).toMatchObject({ text: "Books read" });
  });
});
