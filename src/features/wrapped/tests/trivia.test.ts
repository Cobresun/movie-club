import { numberTrivia } from "../trivia";

describe("numberTrivia", () => {
  const ask = (seed: string, value: number) => numberTrivia(seed, value, "hour", "Q", "R");

  it("offers the answer among four distinct counts, smallest first", () => {
    for (const seed of ["2023", "2024", "2025", "2026", "2027"]) {
      const trivia = ask(seed, 37);
      const counts = trivia?.options.map((option) => Number(option.id)) ?? [];

      expect(counts).toHaveLength(4);
      expect(counts).toContain(37);
      expect(counts).toStrictEqual([...counts].sort((a, b) => a - b));
      expect(trivia?.answerId).toBe("37");
    }
  });

  it.each([1, 2, 3])("offers four distinct positive counts for a total of %i", (value) => {
    for (const seed of ["2023", "2024", "2025", "2026", "2027"]) {
      const counts = ask(seed, value)?.options.map((option) => Number(option.id)) ?? [];

      expect(new Set(counts).size).toBe(4);
      expect(counts).toContain(value);
      expect(counts.every((count) => count > 0)).toBe(true);
    }
  });

  it("labels a count of one in the singular", () => {
    const labels = ask("2025", 1)?.options.map((option) => option.label);

    expect(labels).toContain("1 hour");
    expect(labels).toContain("2 hours");
  });

  it("has nothing to ask when there is nothing to count", () => {
    expect(ask("2025", 0)).toBeUndefined();
  });
});
