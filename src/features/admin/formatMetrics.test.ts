import { describe, expect, it } from "vitest";

import {
  formatBucket,
  formatChange,
  formatCount,
  formatRelativeTime,
  integerTickStep,
  memberSummary,
  percentOf,
  pluralize,
  rateFraction,
  ratePercent,
  thinLabels,
} from "./formatMetrics";

describe("formatCount", () => {
  it("groups thousands", () => {
    expect(formatCount(1186)).toBe("1,186");
    expect(formatCount(0)).toBe("0");
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

  it("has no percentage at all over an empty denominator", () => {
    expect(ratePercent({ numerator: 0, denominator: 0 })).toBeNull();
    expect(rateFraction({ numerator: 0, denominator: 0 })).toBe("0 of 0");
  });
});

describe("formatChange", () => {
  it("is a percentage when there is a base to take one of", () => {
    expect(formatChange({ current: 14, previous: 10 })).toEqual({ label: "+40%", direction: "up" });
    expect(formatChange({ current: 5, previous: 10 })).toEqual({
      label: "−50%",
      direction: "down",
    });
  });

  it("is the absolute change when starting from zero, rather than an infinite percentage", () => {
    expect(formatChange({ current: 3, previous: 0 })).toEqual({ label: "+3", direction: "up" });
  });

  it("says so when nothing moved", () => {
    expect(formatChange({ current: 0, previous: 0 })).toEqual({
      label: "No change",
      direction: "flat",
    });
  });

  it("is null when there is no previous period to compare with", () => {
    expect(formatChange({ current: 12, previous: null })).toBeNull();
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
    expect(formatRelativeTime("2026-04-30T12:00:00Z", now)).toBe("3 months ago");
    expect(formatRelativeTime("2024-07-30T12:00:00Z", now)).toBe("2 years ago");
  });

  it("says 'unknown' rather than 'NaN ago' for an unparseable timestamp", () => {
    expect(formatRelativeTime("not a date", now)).toBe("unknown");
  });
});

describe("formatBucket", () => {
  it("names days and weeks by their date, and months by month and year", () => {
    expect(formatBucket("2026-09-21", "day")).toBe("Sep 21");
    expect(formatBucket("2026-09-21", "week")).toBe("Sep 21");
    expect(formatBucket("2026-09-01", "month")).toBe("Sep 2026");
  });

  it("falls back to the raw key rather than 'Invalid Date'", () => {
    expect(formatBucket("garbage", "day")).toBe("garbage");
  });
});

describe("memberSummary", () => {
  it("names everyone in a small club", () => {
    expect(memberSummary(["Ada", "Grace"])).toBe("Ada, Grace");
  });

  it("collapses the tail once the row would get long", () => {
    expect(memberSummary(["Brian", "Kevin", "sunny", "Zed"])).toBe("Brian, Kevin, sunny +1");
  });

  it("says a club with nobody in it has no members", () => {
    expect(memberSummary([])).toBe("No members");
  });
});

describe("pluralize", () => {
  it("agrees the noun with the count", () => {
    expect(pluralize(1, "review")).toBe("1 review");
    expect(pluralize(0, "review")).toBe("0 reviews");
    expect(pluralize(1200, "list add")).toBe("1,200 list adds");
  });
});

describe("thinLabels", () => {
  it("keeps every label when they all fit", () => {
    const show = thinLabels(5, 6);
    expect([0, 1, 2, 3, 4].map(show)).toEqual([true, true, true, true, true]);
  });

  it("always labels the most recent bucket, whatever the step", () => {
    for (const count of [7, 13, 30, 52]) {
      expect(thinLabels(count, 6)(count - 1)).toBe(true);
    }
  });

  it("thins a 30-day axis down to roughly the target", () => {
    const show = thinLabels(30, 5);
    const shown = Array.from({ length: 30 }, (_, index) => index).filter(show);
    expect(shown.length).toBeLessThanOrEqual(6);
    expect(shown.length).toBeGreaterThanOrEqual(4);
  });
});

describe("integerTickStep", () => {
  it("never drops below 1, so a quiet week can't produce fractional ticks", () => {
    expect(integerTickStep(0)).toBe(1);
    expect(integerTickStep(1)).toBe(1);
  });

  it("grows the step so a large range stays readable", () => {
    expect(integerTickStep(50)).toBe(10);
  });
});
