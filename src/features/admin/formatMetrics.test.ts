import { describe, expect, it } from "vitest";

import {
  fillMissingWeeks,
  formatCount,
  integerTickStep,
  mergeWeekly,
  percentOf,
} from "./formatMetrics";

describe("formatCount", () => {
  it("groups thousands", () => {
    expect(formatCount(1186)).toBe("1,186");
    expect(formatCount(0)).toBe("0");
    expect(formatCount(83)).toBe("83");
  });
});

describe("percentOf", () => {
  it("rounds to a whole percentage", () => {
    expect(percentOf(69, 83)).toBe(83);
    expect(percentOf(1, 3)).toBe(33);
  });

  it("returns 0 rather than NaN when the total is zero", () => {
    expect(percentOf(0, 0)).toBe(0);
  });
});

describe("fillMissingWeeks", () => {
  it("returns an empty series unchanged", () => {
    expect(fillMissingWeeks([])).toEqual([]);
  });

  it("leaves a contiguous series alone", () => {
    const points = [
      { weekStart: "2026-02-02", count: 4 },
      { weekStart: "2026-02-09", count: 1 },
    ];
    expect(fillMissingWeeks(points)).toEqual(points);
  });

  it("inserts zero buckets for the weeks the query omitted", () => {
    const points = [
      { weekStart: "2026-01-26", count: 1 },
      { weekStart: "2026-02-16", count: 3 },
    ];

    expect(fillMissingWeeks(points)).toEqual([
      { weekStart: "2026-01-26", count: 1 },
      { weekStart: "2026-02-02", count: 0 },
      { weekStart: "2026-02-09", count: 0 },
      { weekStart: "2026-02-16", count: 3 },
    ]);
  });

  it("keeps a single bucket as a single point", () => {
    expect(fillMissingWeeks([{ weekStart: "2026-07-27", count: 12 }])).toEqual([
      { weekStart: "2026-07-27", count: 12 },
    ]);
  });

  it("crosses a month and year boundary without drifting", () => {
    const filled = fillMissingWeeks([
      { weekStart: "2025-12-22", count: 2 },
      { weekStart: "2026-01-12", count: 5 },
    ]);

    expect(filled.map((point) => point.weekStart)).toEqual([
      "2025-12-22",
      "2025-12-29",
      "2026-01-05",
      "2026-01-12",
    ]);
  });
});

describe("mergeWeekly", () => {
  it("is empty when both series are empty", () => {
    expect(mergeWeekly([], [])).toEqual([]);
  });

  it("aligns weeks present in only one series", () => {
    const users = [{ weekStart: "2026-02-02", count: 3 }];
    const clubs = [{ weekStart: "2026-02-16", count: 1 }];

    expect(mergeWeekly(users, clubs)).toEqual([
      { weekStart: "2026-02-02", users: 3, clubs: 0 },
      { weekStart: "2026-02-09", users: 0, clubs: 0 },
      { weekStart: "2026-02-16", users: 0, clubs: 1 },
    ]);
  });

  it("spans the union of both series when one starts earlier", () => {
    const users = [{ weekStart: "2026-02-09", count: 2 }];
    const clubs = [
      { weekStart: "2026-02-02", count: 1 },
      { weekStart: "2026-02-09", count: 4 },
    ];

    expect(mergeWeekly(users, clubs)).toEqual([
      { weekStart: "2026-02-02", users: 0, clubs: 1 },
      { weekStart: "2026-02-09", users: 2, clubs: 4 },
    ]);
  });
});

describe("integerTickStep", () => {
  it("never drops below 1, so a quiet week can't produce fractional ticks", () => {
    expect(integerTickStep(0)).toBe(1);
    expect(integerTickStep(1)).toBe(1);
    expect(integerTickStep(6)).toBe(1);
  });

  it("grows the step so a large range stays readable", () => {
    expect(integerTickStep(60)).toBe(10);
    expect(integerTickStep(100)).toBe(17);
  });
});
