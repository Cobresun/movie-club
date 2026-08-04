import { describe, expect, it } from "vitest";

import { SnapshotHistoryPoint } from "../../../lib/types/metrics";
import {
  deltaOverDays,
  formatCount,
  formatDuration,
  formatRelativeTime,
  integerTickStep,
  mergeWeekly,
  percentOf,
  rateFraction,
  ratePercent,
  stickiness,
  thinLabels,
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

describe("ratePercent / rateFraction", () => {
  it("reports both the percentage and the parts behind it", () => {
    const rate = { numerator: 5, denominator: 8 };
    expect(ratePercent(rate)).toBe(63);
    expect(rateFraction(rate)).toBe("5 of 8");
  });

  it("survives an empty denominator", () => {
    expect(ratePercent({ numerator: 0, denominator: 0 })).toBe(0);
    expect(rateFraction({ numerator: 0, denominator: 0 })).toBe("0 of 0");
  });
});

describe("stickiness", () => {
  it("reports weekly actives as a share of monthly actives", () => {
    expect(stickiness({ last7Days: 12, last30Days: 40 })).toBe(30);
  });

  it("is null rather than 0 when nobody was active at all", () => {
    expect(stickiness({ last7Days: 0, last30Days: 0 })).toBeNull();
  });
});

describe("formatDuration", () => {
  it("drops to hours below a day, because '0.3 days' reads as nothing", () => {
    expect(formatDuration(0.5)).toBe("12 hours");
    expect(formatDuration(0.04)).toBe("1 hour");
  });

  it("uses whole days above one, singular where it should be", () => {
    expect(formatDuration(1)).toBe("1 day");
    expect(formatDuration(4.6)).toBe("5 days");
  });
});

describe("formatRelativeTime", () => {
  // The suite pins TZ=UTC (vite.config.ts), so a fixed `now` is deterministic.
  const now = Date.parse("2026-07-30T12:00:00Z");

  it("collapses anything under a minute to 'just now'", () => {
    expect(formatRelativeTime("2026-07-30T11:59:40Z", now)).toBe("just now");
  });

  it("scales the unit with the distance", () => {
    expect(formatRelativeTime("2026-07-30T11:56:00Z", now)).toBe("4 minutes ago");
    expect(formatRelativeTime("2026-07-30T09:00:00Z", now)).toBe("3 hours ago");
    expect(formatRelativeTime("2026-07-28T12:00:00Z", now)).toBe("2 days ago");
  });

  it("says 'unknown' rather than 'NaN ago' for an unparseable timestamp", () => {
    expect(formatRelativeTime("not a date", now)).toBe("unknown");
  });
});

describe("deltaOverDays", () => {
  const now = Date.parse("2026-07-30T12:00:00Z");

  const point = (capturedOn: string, users: number): SnapshotHistoryPoint => ({
    capturedOn,
    metrics: {
      totals: { users, clubs: 0, reviews: 0 },
      engagedUsers: { last7Days: 0, last30Days: 0 },
      loggedInUsers: { last7Days: 0, last30Days: 0 },
      activeClubs: { last7Days: 0, last30Days: 0 },
    },
  });

  it("measures against the newest snapshot at or before the cutoff", () => {
    const history = [point("2026-07-10", 100), point("2026-07-22", 120), point("2026-07-29", 140)];

    // 7 days back from the 30th is the 23rd; the 22nd is the closest snapshot
    // at or before that, not the newer 29th.
    expect(deltaOverDays(history, "users", 150, 7, now)).toBe(30);
  });

  it("is null, not 0, when no snapshot reaches back far enough", () => {
    expect(deltaOverDays([point("2026-07-29", 140)], "users", 150, 7, now)).toBeNull();
    expect(deltaOverDays([], "users", 150, 7, now)).toBeNull();
  });

  it("reports a negative delta when rows were deleted", () => {
    expect(deltaOverDays([point("2026-07-01", 200)], "users", 150, 7, now)).toBe(-50);
  });
});

describe("thinLabels", () => {
  it("keeps every label when they all fit", () => {
    const show = thinLabels(5, 6);
    expect([0, 1, 2, 3, 4].map(show)).toEqual([true, true, true, true, true]);
  });

  it("always labels the most recent bucket, whatever the step", () => {
    for (const count of [7, 13, 26, 52]) {
      expect(thinLabels(count, 6)(count - 1)).toBe(true);
    }
  });

  it("thins a 26-week axis down to roughly the target", () => {
    const show = thinLabels(26, 6);
    const shown = Array.from({ length: 26 }, (_, index) => index).filter(show);
    expect(shown.length).toBeLessThanOrEqual(7);
    expect(shown.length).toBeGreaterThanOrEqual(5);
  });
});

describe("mergeWeekly", () => {
  it("is empty when every series is empty", () => {
    expect(mergeWeekly([], [], [])).toEqual([]);
  });

  it("aligns weeks present in only one series", () => {
    const users = [{ weekStart: "2026-02-02", count: 3 }];
    const clubs = [{ weekStart: "2026-02-16", count: 1 }];
    const reviews = [{ weekStart: "2026-02-09", count: 7 }];

    expect(mergeWeekly(users, clubs, reviews)).toEqual([
      { weekStart: "2026-02-02", users: 3, clubs: 0, reviews: 0 },
      { weekStart: "2026-02-09", users: 0, clubs: 0, reviews: 7 },
      { weekStart: "2026-02-16", users: 0, clubs: 1, reviews: 0 },
    ]);
  });

  it("spans the union of the series when one starts earlier", () => {
    const users = [{ weekStart: "2026-02-09", count: 2 }];
    const clubs = [
      { weekStart: "2026-02-02", count: 1 },
      { weekStart: "2026-02-09", count: 4 },
    ];

    expect(mergeWeekly(users, clubs, [])).toEqual([
      { weekStart: "2026-02-02", users: 0, clubs: 1, reviews: 0 },
      { weekStart: "2026-02-09", users: 2, clubs: 4, reviews: 0 },
    ]);
  });

  it("crosses a year boundary without drifting", () => {
    const merged = mergeWeekly(
      [
        { weekStart: "2025-12-22", count: 2 },
        { weekStart: "2026-01-12", count: 5 },
      ],
      [],
      [],
    );

    expect(merged.map((week) => week.weekStart)).toEqual([
      "2025-12-22",
      "2025-12-29",
      "2026-01-05",
      "2026-01-12",
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
