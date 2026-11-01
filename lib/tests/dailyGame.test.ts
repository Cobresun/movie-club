import { isSomebodysToday, pickAnswer, puzzleNumber, upcomingPuzzleDates } from "../dailyGame";

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

describe("upcomingPuzzleDates", () => {
  it("covers UTC's today and the tomorrow time zones east of it are already on", () => {
    expect(upcomingPuzzleDates(new Date("2026-12-31T23:30:00Z"))).toStrictEqual([
      "2026-12-31",
      "2027-01-01",
    ]);
  });
});

describe("puzzleNumber", () => {
  it("counts every calendar day since the first puzzle", () => {
    expect(puzzleNumber("2026-10-22", "2026-10-22")).toBe(1);
    expect(puzzleNumber("2026-10-22", "2026-11-05")).toBe(15);
  });

  it("counts a leap day", () => {
    expect(puzzleNumber("2028-02-28", "2028-03-01")).toBe(3);
  });
});
