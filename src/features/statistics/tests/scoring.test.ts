import type { Member } from "../../../../lib/types/club";
import {
  normalizeArray,
  createHistogramData,
  getScoreContextColor,
  createHistogramOptions,
  createDecadeChartOptions,
  createScoreVarianceChartOptions,
  createScoreTrendChartOptions,
} from "../scoring";
import type {
  DecadeStats,
  MovieData,
  ScoreTrendPoint,
  ScoreVariancePoint,
} from "../types";

// ---------- chart-option access helpers ----------
// ag-charts option types are wide unions that cannot be narrowed structurally,
// so these runtime predicates (in the style of lib/checks) replace `as` casts.

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function asRecord(v: unknown): Record<string, unknown> {
  if (!isRecord(v)) throw new Error("expected an object");
  return v;
}

function asRecordArray(v: unknown): Record<string, unknown>[] {
  if (!Array.isArray(v)) throw new Error("expected an array");
  const items: unknown[] = v;
  return items.map(asRecord);
}

type TooltipRendererParams = {
  datum: unknown;
  itemId: string;
  xKey: string;
  yKey: string;
  seriesId: string;
};

function isTooltipRenderer(
  v: unknown,
): v is (p: TooltipRendererParams) => unknown {
  return typeof v === "function";
}

function renderTooltip(series: Record<string, unknown>, datum: unknown) {
  const renderer = asRecord(series.tooltip).renderer;
  if (!isTooltipRenderer(renderer)) {
    throw new Error("expected a tooltip renderer function");
  }
  const html = renderer({
    datum,
    itemId: "",
    xKey: "",
    yKey: "",
    seriesId: "",
  });
  if (typeof html !== "string") {
    throw new Error("expected tooltip renderer to return a string");
  }
  return html;
}

// ---------- normalizeArray ----------

describe("normalizeArray", () => {
  it("returns empty array for empty input", () => {
    expect(normalizeArray([])).toEqual([]);
  });

  it("returns all zeros when all values are identical", () => {
    expect(normalizeArray([5, 5, 5, 5])).toEqual([0, 0, 0, 0]);
  });

  it("returns zero for single element", () => {
    expect(normalizeArray([7])).toEqual([0]);
  });

  it("normalizes correctly with known values", () => {
    // [2, 4, 6] → mean=4, std=2
    // z-scores: (2-4)/2=-1, (4-4)/2=0, (6-4)/2=1
    const result = normalizeArray([2, 4, 6]);
    expect(result).toEqual([-1, 0, 1]);
  });

  it("handles negative z-scores and positive z-scores", () => {
    const result = normalizeArray([1, 5, 9]);
    // mean=5, variance=((1-5)^2+(5-5)^2+(9-5)^2)/2=16, std=4
    // z: (1-5)/4=-1, (5-5)/4=0, (9-5)/4=1
    expect(result[0]).toBeLessThan(0);
    expect(result[1]).toBe(0);
    expect(result[2]).toBeGreaterThan(0);
  });

  it("rounds to 2 decimal places", () => {
    const result = normalizeArray([1, 2, 3, 4, 5]);
    for (const val of result) {
      if (val === undefined) continue;
      const decimals = val.toString().split(".")[1];
      if (decimals) {
        expect(decimals.length).toBeLessThanOrEqual(2);
      }
    }
  });

  it("preserves undefined positions in output", () => {
    const result = normalizeArray([2, undefined, 6]);
    expect(result[0]).toBeDefined();
    expect(result[1]).toBeUndefined();
    expect(result[2]).toBeDefined();
  });

  it("computes normalization only from defined values", () => {
    // [2, undefined, 6] → defined=[2,6], mean=4, std=√((4+4)/1)=√8≈2.83
    // z(2)=(2-4)/2.83≈-0.71, z(6)=(6-4)/2.83≈0.71
    const result = normalizeArray([2, undefined, 6]);
    expect(result[0]).toBeLessThan(0);
    expect(result[1]).toBeUndefined();
    expect(result[2]).toBeGreaterThan(0);
  });

  it("returns 0 for single defined value among undefineds", () => {
    const result = normalizeArray([undefined, 5, undefined]);
    expect(result[0]).toBeUndefined();
    expect(result[1]).toBe(0);
    expect(result[2]).toBeUndefined();
  });
});

// ---------- createHistogramData ----------

describe("createHistogramData", () => {
  it("returns empty array for empty scores", () => {
    expect(createHistogramData([])).toEqual([]);
  });

  it("creates 11 bins (0-10)", () => {
    const result = createHistogramData([5, 7, 3]);
    expect(result).toHaveLength(11);
    expect(result[0].bin).toBe(0);
    expect(result[10].bin).toBe(10);
  });

  it("each bin has the correct bin number", () => {
    const result = createHistogramData([1, 2]);
    for (let i = 0; i <= 10; i++) {
      expect(result[i].bin).toBe(i);
    }
  });
});

// ---------- getScoreContextColor ----------

describe("getScoreContextColor", () => {
  it('returns "transparent" for undefined', () => {
    expect(getScoreContextColor(undefined)).toBe("transparent");
  });

  it('returns "transparent" for NaN', () => {
    expect(getScoreContextColor(NaN)).toBe("transparent");
  });

  it('returns "transparent" for values in dead zone (|z| < 0.1)', () => {
    expect(getScoreContextColor(0)).toBe("transparent");
    expect(getScoreContextColor(0.05)).toBe("transparent");
    expect(getScoreContextColor(-0.09)).toBe("transparent");
  });

  it("returns green rgba for positive z-scores", () => {
    const color = getScoreContextColor(1.0);
    expect(color).toMatch(/^rgba\(34, 197, 94,/);
  });

  it("returns red rgba for negative z-scores", () => {
    const color = getScoreContextColor(-1.0);
    expect(color).toMatch(/^rgba\(239, 68, 68,/);
  });

  it("increases opacity with larger absolute z-scores", () => {
    const extractOpacity = (color: string) =>
      parseFloat(color.split(",")[3].replace(")", "").trim());

    const lowOpacity = extractOpacity(getScoreContextColor(0.5));
    const highOpacity = extractOpacity(getScoreContextColor(1.5));
    expect(highOpacity).toBeGreaterThan(lowOpacity);
  });

  it("caps opacity at maxOpacity (0.45)", () => {
    const color = getScoreContextColor(10);
    const opacity = parseFloat(color.split(",")[3].replace(")", "").trim());
    expect(opacity).toBe(0.45);
  });

  it("boundary: z-score of exactly 0.1 is not transparent", () => {
    expect(getScoreContextColor(0.1)).not.toBe("transparent");
  });

  it("boundary: z-score of exactly -0.1 is not transparent", () => {
    expect(getScoreContextColor(-0.1)).not.toBe("transparent");
  });
});

// ---------- createHistogramOptions ----------

function makeMember(id: string, name: string): Member {
  return { id, name, email: `${id}@test.com`, image: "" };
}

function makeMovieData(overrides: Partial<MovieData> = {}): MovieData {
  return {
    id: "1",
    type: "movie" as MovieData["type"],
    title: "Test Movie",
    createdDate: "2024-01-01T00:00:00.000Z",
    imageUrl: undefined,
    genres: [],
    production_companies: [],
    production_countries: [],
    average: 7,
    userScores: {},
    normalized: {},
    scores: {},
    externalData: {
      kind: "movie",
      actors: [],
      adult: false,
      backdrop_path: "",
      budget: 0,
      directors: [],
      genres: [],
      homepage: "",
      id: 1,
      imdb_id: "",
      original_language: "en",
      original_title: "",
      overview: "",
      popularity: 0,
      poster_path: "",
      production_companies: [],
      production_countries: [],
      release_date: "2024-01-01",
      revenue: 0,
      runtime: 120,
      spoken_languages: [],
      status: "Released",
      tagline: "",
      title: "",
      video: false,
      vote_average: 7,
      vote_count: 100,
    },
    dateWatched: "1/1/2024",
    ...overrides,
  };
}

describe("createHistogramOptions", () => {
  it("returns options with theme and background", () => {
    const options = createHistogramOptions({
      filteredMovieData: [],
      histogramData: createHistogramData([]),
      members: [],
    });
    expect(options.theme).toBe("ag-default-dark");
    expect(options.background).toEqual({ visible: false });
  });

  it("creates one series per member", () => {
    const members = [makeMember("m1", "Alice"), makeMember("m2", "Bob")];
    const options = createHistogramOptions({
      filteredMovieData: [],
      histogramData: createHistogramData([5, 7]),
      members,
    });
    expect(options.series).toHaveLength(2);
  });

  it("counts scores into correct bins for each member", () => {
    const members = [makeMember("m1", "Alice")];
    const movies = [
      makeMovieData({ userScores: { m1: 8 } }),
      makeMovieData({ id: "2", userScores: { m1: 8 } }),
      makeMovieData({ id: "3", userScores: { m1: 5 } }),
    ];
    const histData = createHistogramData([5]);
    const options = createHistogramOptions({
      filteredMovieData: movies,
      histogramData: histData,
      members,
    });
    const data = options.data as { bin: number; m1: number }[];
    expect(data[8].m1).toBe(2);
    expect(data[5].m1).toBe(1);
  });

  it("skips members with undefined scores", () => {
    const members = [makeMember("m1", "Alice")];
    const movies = [makeMovieData({ userScores: { m1: undefined } })];
    const histData = createHistogramData([5]);
    const options = createHistogramOptions({
      filteredMovieData: movies,
      histogramData: histData,
      members,
    });
    const data = options.data as { bin: number; m1: number }[];
    const totalCount = data.reduce((sum, bin) => sum + (bin.m1 ?? 0), 0);
    expect(totalCount).toBe(0);
  });

  it("tooltip renderer returns html string", () => {
    const members = [makeMember("m1", "Alice")];
    const options = createHistogramOptions({
      filteredMovieData: [],
      histogramData: createHistogramData([5]),
      members,
    });
    const series = options.series as {
      tooltip: { renderer: (p: unknown) => string };
    }[];
    const result = series[0].tooltip.renderer({
      yKey: "m1",
      xName: "Score",
      yName: "Alice",
      datum: { bin: 7, m1: 3 },
    });
    expect(result).toContain("Alice");
    expect(result).toContain("Score");
  });

  it("has two axes (category and number)", () => {
    const options = createHistogramOptions({
      filteredMovieData: [],
      histogramData: createHistogramData([]),
      members: [],
    });
    const axes = options.axes as { type: string }[];
    expect(axes).toHaveLength(2);
    expect(axes[0].type).toBe("category");
    expect(axes[1].type).toBe("number");
  });
});

// ---------- createDecadeChartOptions ----------

describe("createDecadeChartOptions", () => {
  const sampleDecades: DecadeStats[] = [
    { decade: "1990s", averageScore: 8, count: 5 },
    { decade: "2000s", averageScore: 7, count: 3 },
  ];

  it("returns options with theme and background", () => {
    const options = createDecadeChartOptions(sampleDecades);
    expect(options.theme).toBe("ag-default-dark");
    expect(options.background).toEqual({ visible: false });
  });

  it("uses the provided data", () => {
    const options = createDecadeChartOptions(sampleDecades);
    expect(options.data).toEqual(sampleDecades);
  });

  it("has one bar series", () => {
    const options = createDecadeChartOptions(sampleDecades);
    const series = asRecordArray(options.series);
    expect(series).toHaveLength(1);
    expect(series[0].type).toBe("bar");
    expect(series[0].yKey).toBe("averageScore");
  });

  it("tooltip renderer returns html with decade and score", () => {
    const options = createDecadeChartOptions(sampleDecades);
    const html = renderTooltip(
      asRecordArray(options.series)[0],
      sampleDecades[0],
    );
    expect(html).toContain("1990s");
    expect(html).toContain("Avg Score: 8");
    expect(html).toContain("Movies: 5");
  });

  it("has two axes (category and number with max 10)", () => {
    const options = createDecadeChartOptions(sampleDecades);
    const axes = asRecordArray(options.axes);
    expect(axes).toHaveLength(2);
    expect(axes[1].max).toBe(10);
  });
});

// ---------- createScoreVarianceChartOptions ----------

describe("createScoreVarianceChartOptions", () => {
  const samplePoints: ScoreVariancePoint[] = [
    {
      date: new Date("2024-01-01"),
      movieTitle: "Movie A",
      movieStdDev: 2.5,
      rollingStdDev: 2.1,
    },
  ];

  it("returns options with theme and background", () => {
    const options = createScoreVarianceChartOptions(samplePoints);
    expect(options.theme).toBe("ag-default-dark");
    expect(options.background).toEqual({ visible: false });
  });

  it("uses the provided data", () => {
    const options = createScoreVarianceChartOptions(samplePoints);
    expect(options.data).toEqual(samplePoints);
  });

  it("has one line series for rollingStdDev", () => {
    const options = createScoreVarianceChartOptions(samplePoints);
    const series = asRecordArray(options.series);
    expect(series).toHaveLength(1);
    expect(series[0].type).toBe("line");
    expect(series[0].yKey).toBe("rollingStdDev");
  });

  it("tooltip renderer returns html with movie title and spreads", () => {
    const options = createScoreVarianceChartOptions(samplePoints);
    const html = renderTooltip(
      asRecordArray(options.series)[0],
      samplePoints[0],
    );
    expect(html).toContain("Movie A");
    expect(html).toContain("2.50");
    expect(html).toContain("2.10");
  });

  it("legend is disabled", () => {
    const options = createScoreVarianceChartOptions(samplePoints);
    expect(asRecord(options.legend).enabled).toBe(false);
  });

  it("handles empty data array", () => {
    const options = createScoreVarianceChartOptions([]);
    expect(options.data).toEqual([]);
  });
});

// ---------- createScoreTrendChartOptions ----------

describe("createScoreTrendChartOptions", () => {
  function makeTrendPoint(
    overrides: Partial<ScoreTrendPoint> = {},
  ): ScoreTrendPoint {
    return {
      date: new Date("2024-06-01"),
      movieTitle: "Test Movie",
      actualScore: 8,
      rollingAverage: 7.5,
      ...overrides,
    };
  }

  it("returns options with theme and background", () => {
    const trendData = new Map<string, ScoreTrendPoint[]>();
    const options = createScoreTrendChartOptions(trendData, []);
    expect(options.theme).toBe("ag-default-dark");
    expect(options.background).toEqual({ visible: false });
  });

  it("creates one series per member with data", () => {
    const members = [makeMember("m1", "Alice"), makeMember("m2", "Bob")];
    const trendData = new Map<string, ScoreTrendPoint[]>([
      ["m1", [makeTrendPoint()]],
      ["m2", [makeTrendPoint({ movieTitle: "Other" })]],
    ]);
    const options = createScoreTrendChartOptions(trendData, members);
    const series = asRecordArray(options.series);
    expect(series).toHaveLength(2);
    expect(series.map((s) => s.yName)).toEqual(["Alice", "Bob"]);
  });

  it("excludes members with no trend data", () => {
    const members = [makeMember("m1", "Alice"), makeMember("m2", "Bob")];
    const trendData = new Map<string, ScoreTrendPoint[]>([
      ["m1", [makeTrendPoint()]],
    ]);
    const options = createScoreTrendChartOptions(trendData, members);
    const series = asRecordArray(options.series);
    expect(series).toHaveLength(1);
    expect(series[0].yName).toBe("Alice");
  });

  it("yMin is 0 when no data", () => {
    const options = createScoreTrendChartOptions(new Map(), []);
    const axes = asRecordArray(options.axes);
    expect(axes[1].min).toBe(0);
  });

  it("yMin is at least 0 even for very low scores", () => {
    const members = [makeMember("m1", "Alice")];
    const trendData = new Map<string, ScoreTrendPoint[]>([
      ["m1", [makeTrendPoint({ rollingAverage: 0.5 })]],
    ]);
    const options = createScoreTrendChartOptions(trendData, members);
    const axes = asRecordArray(options.axes);
    const yMin = axes[1].min;
    if (typeof yMin !== "number") {
      throw new Error("expected a numeric y-axis min");
    }
    expect(yMin).toBeGreaterThanOrEqual(0);
  });

  it("tooltip renderer returns html with member name, movie title and scores", () => {
    const members = [makeMember("m1", "Alice")];
    const point = makeTrendPoint({
      movieTitle: "Inception",
      actualScore: 9,
      rollingAverage: 8.5,
    });
    const trendData = new Map<string, ScoreTrendPoint[]>([["m1", [point]]]);
    const options = createScoreTrendChartOptions(trendData, members);
    const html = renderTooltip(asRecordArray(options.series)[0], point);
    expect(html).toContain("Alice");
    expect(html).toContain("Inception");
    expect(html).toContain("9");
    expect(html).toContain("8.5");
  });

  it("legend is at bottom", () => {
    const options = createScoreTrendChartOptions(new Map(), []);
    expect(asRecord(options.legend).position).toBe("bottom");
  });

  it("wraps color index for more than 8 members", () => {
    const members = Array.from({ length: 9 }, (_, i) =>
      makeMember(`m${i}`, `Member${i}`),
    );
    const trendData = new Map(members.map((m) => [m.id, [makeTrendPoint()]]));
    // should not throw — color index wraps with modulo
    expect(() =>
      createScoreTrendChartOptions(trendData, members),
    ).not.toThrow();
    const options = createScoreTrendChartOptions(trendData, members);
    const series = asRecordArray(options.series);
    expect(series).toHaveLength(9);
    // 9th member (index 8) wraps to index 0 color
    expect(series[8].stroke).toBe(series[0].stroke);
  });
});
