import { makeMember, makeMovie } from "../../statistics/tests/fixtures";
import {
  computeClosestMatches,
  computeHotTakes,
  computePicks,
  isYearInProgress,
  worksInYear,
  wrappedYears,
} from "../wrapped";

const alice = makeMember({ id: "a", name: "Alice Smith" });
const bob = makeMember({ id: "b", name: "Bob Jones" });
const cara = makeMember({ id: "c", name: "Cara Lee" });

describe("wrappedYears", () => {
  it("lists each year the club reviewed in once, newest first", () => {
    const works = [
      makeMovie({ id: "1", createdDate: "2024-03-01T00:00:00.000Z" }),
      makeMovie({ id: "2", createdDate: "2025-06-01T00:00:00.000Z" }),
      makeMovie({ id: "3", createdDate: "2024-11-01T00:00:00.000Z" }),
    ];

    expect(wrappedYears(works)).toEqual([2025, 2024]);
  });

  it("files a review made at midnight UTC on New Year's Day under the new year", () => {
    const newYear = makeMovie({ id: "1", createdDate: "2025-01-01T00:00:00.000Z" });

    expect(worksInYear([newYear], 2025)).toEqual([newYear]);
    expect(worksInYear([newYear], 2024)).toEqual([]);
  });
});

describe("isYearInProgress", () => {
  it("is true only for the current calendar year", () => {
    const now = new Date("2026-09-27T12:00:00.000Z");

    expect(isYearInProgress(2026, now)).toBe(true);
    expect(isYearInProgress(2025, now)).toBe(false);
  });
});

describe("computePicks", () => {
  const works = (averages: number[]) =>
    averages.map((average, index) => makeMovie({ id: String(index), title: `W${index}`, average }));

  it("takes the three best and three worst of a full year", () => {
    const { top, bottom } = computePicks(works([5, 9, 1, 7, 3, 8, 2]));

    expect(top.map((work) => work.average)).toEqual([9, 8, 7]);
    expect(bottom.map((work) => work.average)).toEqual([1, 2, 3]);
  });

  it("never shows the same work as both a top and a bottom pick", () => {
    const { top, bottom } = computePicks(works([4, 8, 6]));

    expect(top.map((work) => work.average)).toEqual([8]);
    expect(bottom.map((work) => work.average)).toEqual([4]);
  });

  it("has no picks for a single work", () => {
    expect(computePicks(works([7]))).toEqual({ top: [], bottom: [] });
  });
});

describe("computeHotTakes", () => {
  it("finds each member's score furthest from everyone else's", () => {
    const works = [
      makeMovie({ id: "1", title: "Cats", userScores: { a: 9, b: 2, c: 3 } }),
      makeMovie({ id: "2", title: "Heat", userScores: { a: 8, b: 8, c: 3 } }),
    ];

    const takes = computeHotTakes(works, [alice, bob, cara]);

    expect(takes.map((take) => [take.member.name, take.title, take.gap])).toEqual([
      ["Alice Smith", "Cats", 6.5],
      ["Cara Lee", "Heat", -5],
      ["Bob Jones", "Cats", -4],
    ]);
  });

  it("gives no hot take to a member who always agreed", () => {
    const works = [makeMovie({ id: "1", userScores: { a: 7, b: 7 } })];

    expect(computeHotTakes(works, [alice, bob])).toEqual([]);
  });

  it("skips works nobody else scored", () => {
    const works = [makeMovie({ id: "1", userScores: { a: 1 } })];

    expect(computeHotTakes(works, [alice, bob])).toEqual([]);
  });
});

describe("computeClosestMatches", () => {
  it("pairs each member with the clubmate they scored most like", () => {
    const works = ["1", "2", "3"].map((id) => makeMovie({ id, userScores: { a: 8, b: 7, c: 2 } }));

    const matches = computeClosestMatches(works, [alice, bob, cara]);

    expect(matches.map((m) => [m.member.name, m.match.name])).toEqual([
      ["Alice Smith", "Bob Jones"],
      ["Bob Jones", "Alice Smith"],
      ["Cara Lee", "Bob Jones"],
    ]);
  });
});
