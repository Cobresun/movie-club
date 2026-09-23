import { describe, expect, it } from "vitest";

import { scoreAward, stepChangeError } from "../awards";
import { AwardsStep, BaseAward, BaseAwardNomination } from "../types/awards";

const nominee = (movieId: number, ranking: Record<string, number>): BaseAwardNomination => ({
  movieId,
  nominatedBy: ["1"],
  ranking,
});

const winners = (nominations: BaseAwardNomination[]) =>
  scoreAward(nominations)
    .results.filter((result) => result.winner)
    .map((result) => result.nomination.movieId);

describe("scoreAward", () => {
  it("crowns the nominee with the lowest total rank", () => {
    const { results } = scoreAward([
      nominee(1, { a: 2, b: 2 }),
      nominee(2, { a: 1, b: 1 }),
      nominee(3, { a: 3, b: 3 }),
    ]);

    expect(results.map((result) => [result.nomination.movieId, result.score])).toEqual([
      [2, 2],
      [1, 4],
      [3, 6],
    ]);
    expect(results.map((result) => result.winner)).toEqual([true, false, false]);
  });

  it("counts a nominee a voter never ranked as their last place, not as zero", () => {
    // `b` voted before nominee 3 existed; it must not win on b's empty column.
    expect(
      winners([nominee(1, { a: 2, b: 1 }), nominee(2, { a: 3, b: 2 }), nominee(3, { a: 1 })]),
    ).toEqual([1]);
  });

  it("shares the win on a tie", () => {
    expect(winners([nominee(1, { a: 1, b: 2 }), nominee(2, { a: 2, b: 1 })])).toEqual([1, 2]);
  });

  it("only counts the members who voted in the category", () => {
    expect(scoreAward([nominee(1, { a: 1 }), nominee(2, { a: 2 })]).voters).toEqual(["a"]);
  });

  it("declares no winner when nobody voted, unless there was only one nominee", () => {
    expect(winners([nominee(1, {}), nominee(2, {})])).toEqual([]);
    expect(winners([nominee(1, {})])).toEqual([1]);
  });
});

describe("stepChangeError", () => {
  const year = (step: AwardsStep, awards: BaseAward[] = [{ title: "C", nominations: [] }]) => ({
    step,
    awards,
  });

  it("allows moving back one step whatever is outstanding", () => {
    expect(
      stepChangeError(year(AwardsStep.Ratings), AwardsStep.Nominations, ["a"]),
    ).toBeUndefined();
  });

  it("refuses to skip or stand still", () => {
    expect(stepChangeError(year(AwardsStep.CategorySelect), AwardsStep.Ratings, [])).toBeDefined();
    expect(stepChangeError(year(AwardsStep.Ratings), AwardsStep.Ratings, [])).toBeDefined();
  });

  it("refuses to open nominations without a category", () => {
    expect(stepChangeError(year(AwardsStep.CategorySelect, []), AwardsStep.Nominations, [])).toBe(
      "Add at least one category before opening nominations",
    );
  });

  it("holds nominations open until every member has a nominee in every category", () => {
    const awards = [
      { title: "A", nominations: [nominee(1, {})] },
      { title: "B", nominations: [{ ...nominee(2, {}), nominatedBy: ["2"] }] },
    ];
    // Member 1 nominated in A only; member 2 in B only.
    expect(
      stepChangeError(year(AwardsStep.Nominations, awards), AwardsStep.Ratings, ["1", "2"]),
    ).toBe("Everyone has to finish nominating first (2 still to go)");

    // Backing an existing nominee counts.
    const backed = [
      { title: "A", nominations: [{ ...nominee(1, {}), nominatedBy: ["1", "2"] }] },
      { title: "B", nominations: [{ ...nominee(2, {}), nominatedBy: ["2", "1"] }] },
    ];
    expect(
      stepChangeError(year(AwardsStep.Nominations, backed), AwardsStep.Ratings, ["1", "2"]),
    ).toBeUndefined();
  });

  it("holds voting open until every member has ranked every contested category", () => {
    const awards = [
      { title: "A", nominations: [nominee(1, { a: 1, b: 2 }), nominee(2, { a: 2 })] },
      // A lone nominee needs no ballot.
      { title: "B", nominations: [nominee(3, {})] },
    ];
    expect(
      stepChangeError(year(AwardsStep.Ratings, awards), AwardsStep.Presentation, ["a", "b"]),
    ).toBe("Everyone has to finish voting first (1 still to go)");
    expect(
      stepChangeError(year(AwardsStep.Ratings, awards), AwardsStep.Presentation, ["a"]),
    ).toBeUndefined();
  });
});
