import { numberTrivia } from "../trivia";

describe("numberTrivia", () => {
  const ask = (seed: string, value: number) => numberTrivia(seed, value, "hours", "Q", "R");

  it("offers the answer among four distinct counts, smallest first", () => {
    for (const seed of ["2023", "2024", "2025", "2026", "2027"]) {
      const trivia = ask(seed, 37);
      const counts = trivia?.options.map((option) => Number(option.id)) ?? [];

      expect(counts).toHaveLength(4);
      expect(counts).toContain(37);
      expect(counts).toEqual([...counts].sort((a, b) => a - b));
      expect(trivia?.answerId).toBe("37");
    }
  });

  it("keeps a tiny total's wrong answers apart from it and each other", () => {
    for (const seed of ["2023", "2024", "2025", "2026", "2027"]) {
      const counts = ask(seed, 3)?.options.map((option) => Number(option.id));
      if (counts === undefined) continue;

      expect(new Set(counts).size).toBe(4);
      expect(counts.every((count) => count > 0)).toBe(true);
    }
  });

  it("has nothing to ask when there is nothing to count", () => {
    expect(ask("2025", 0)).toBeUndefined();
  });
});
