import { hintRank, localDate, previousDate, shareText, temperature } from "../game";

describe("hintRank", () => {
  it("halves the distance from the best guess to the answer", () => {
    expect(hintRank(new Set([40, 300]), 400)).toBe(20);
  });

  it("starts from a share of the pool before any guess", () => {
    expect(hintRank(new Set(), 400)).toBe(48);
    expect(hintRank(new Set(), 20)).toBe(3);
  });

  it("never gives away the answer", () => {
    expect(hintRank(new Set([2]), 400)).toBeUndefined();
    expect(hintRank(new Set([3, 2]), 400)).toBeUndefined();
  });
});

describe("temperature", () => {
  it("scales its cutoffs with the pool", () => {
    expect(temperature(15, 400)).toBe("hot");
    expect(temperature(15, 40)).toBe("cold");
  });

  it("always leaves the runner-up hot, however small the pool", () => {
    expect(temperature(2, 12)).toBe("hot");
  });
});

describe("dates", () => {
  it("names the player's local day", () => {
    expect(localDate(new Date(2026, 9, 22, 23, 59))).toBe("2026-10-22");
    expect(localDate(new Date(2026, 9, 23, 0, 1))).toBe("2026-10-23");
  });

  it("steps back across a month boundary", () => {
    expect(previousDate("2026-11-01")).toBe("2026-10-31");
  });
});

describe("shareText", () => {
  it("lays a long game out ten squares to a row", () => {
    const trail = Array.from({ length: 12 }, (_, index) => ({
      rank: index === 11 ? 1 : 400,
      hint: false,
    }));

    expect(
      shareText({
        name: "Reelated",
        puzzle: 7,
        trail,
        poolSize: 400,
        solved: true,
        streak: 0,
        url: "https://example.test/reelated",
      }),
    ).toBe(
      "Reelated #7: I got it in 12 guesses.\n🟥🟥🟥🟥🟥🟥🟥🟥🟥🟥\n🟥🟩\nhttps://example.test/reelated",
    );
  });
});
