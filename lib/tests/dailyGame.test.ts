import { describe, expect, it } from "vitest";

import { isSomebodysToday, pickAnswer } from "../dailyGame";

describe("pickAnswer", () => {
  it("only draws movies that have never been the answer", () => {
    expect(pickAnswer(["a", "b", "c"], ["a", "c"], () => 0.99)).toBe("b");
  });

  it("brings back the longest-rested movie once every movie has had a turn", () => {
    expect(pickAnswer(["a", "b", "c"], ["b", "a", "c"])).toBe("b");
  });

  it("has nothing to draw from an empty pool", () => {
    expect(pickAnswer([], ["a"])).toBeUndefined();
  });
});

describe("isSomebodysToday", () => {
  const now = new Date("2026-10-22T03:00:00Z");

  it("accepts the dates either side of UTC that some time zone is on", () => {
    expect(isSomebodysToday("2026-10-21", now)).toBe(true);
    expect(isSomebodysToday("2026-10-22", now)).toBe(true);
    expect(isSomebodysToday("2026-10-23", now)).toBe(true);
  });

  it("refuses to look further ahead", () => {
    expect(isSomebodysToday("2026-10-24", now)).toBe(false);
  });
});
