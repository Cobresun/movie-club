import { hintRank, puzzleNumber, searchMovies } from "../game";

describe("hintRank", () => {
  it("halves the distance from the best guess to the answer", () => {
    expect(hintRank(new Set([40, 300]), 400)).toBe(20);
  });

  it("starts from a gentle rank before any guess", () => {
    expect(hintRank(new Set(), 400)).toBe(50);
  });

  it("never gives away the answer", () => {
    expect(hintRank(new Set([2]), 400)).toBeUndefined();
    expect(hintRank(new Set([3, 2]), 400)).toBeUndefined();
  });
});

describe("puzzleNumber", () => {
  it("turns over at the player's local midnight", () => {
    expect(puzzleNumber(new Date(2026, 9, 22, 23, 59))).toBe(1);
    expect(puzzleNumber(new Date(2026, 9, 23, 0, 1))).toBe(2);
  });
});

describe("searchMovies", () => {
  it("matches a title without its leading article", () => {
    expect(searchMovies("dark knight").map((movie) => movie.title)).toContain("The Dark Knight");
  });
});
