import { makeMember, makeMovie } from "../../statistics/tests/fixtures";
import {
  computeClosestMatches,
  computeHotTakes,
  computePicks,
  isYearReleased,
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

    expect(wrappedYears(works)).toStrictEqual([2025, 2024]);
  });

  it("holds back the current year until its Wrapped comes out on January 1", () => {
    const works = [
      makeMovie({ id: "1", createdDate: "2025-06-01T00:00:00.000Z" }),
      makeMovie({ id: "2", createdDate: "2026-03-01T00:00:00.000Z" }),
    ];

    expect(wrappedYears(works, new Date("2026-12-31T23:59:59.000Z"))).toStrictEqual([2025]);
    expect(wrappedYears(works, new Date("2027-01-01T00:00:00.000Z"))).toStrictEqual([2026, 2025]);
  });

  it("files a review made at midnight UTC on New Year's Day under the new year", () => {
    const newYear = makeMovie({ id: "1", createdDate: "2025-01-01T00:00:00.000Z" });

    expect(worksInYear([newYear], 2025)).toStrictEqual([newYear]);
    expect(worksInYear([newYear], 2024)).toStrictEqual([]);
  });
});

describe("isYearReleased", () => {
  it("releases a year on January 1 of the next", () => {
    const newYearsEve = new Date("2026-12-31T23:59:59.000Z");
    const newYearsDay = new Date("2027-01-01T00:00:00.000Z");

    expect(isYearReleased(2025, newYearsEve)).toBe(true);
    expect(isYearReleased(2026, newYearsEve)).toBe(false);
    expect(isYearReleased(2026, newYearsDay)).toBe(true);
    expect(isYearReleased(2027, newYearsDay)).toBe(false);
  });
});

describe("computePicks", () => {
  const works = (averages: number[]) =>
    averages.map((average, index) => makeMovie({ id: String(index), title: `W${index}`, average }));

  it("takes the three best and three worst of a full year", () => {
    const { top, bottom } = computePicks(works([5, 9, 1, 7, 3, 8, 2]));

    expect(top.map((work) => work.average)).toStrictEqual([9, 8, 7]);
    expect(bottom.map((work) => work.average)).toStrictEqual([1, 2, 3]);
  });

  it("never shows the same work as both a top and a bottom pick", () => {
    const { top, bottom } = computePicks(works([4, 8, 6]));

    expect(top.map((work) => work.average)).toStrictEqual([8]);
    expect(bottom.map((work) => work.average)).toStrictEqual([4]);
  });

  it("has no picks for a single work", () => {
    expect(computePicks(works([7]))).toStrictEqual({ top: [], bottom: [] });
  });
});

describe("computeHotTakes", () => {
  it("finds each member's score furthest from everyone else's", () => {
    const works = [
      makeMovie({ id: "1", title: "Cats", userScores: { a: 9, b: 2, c: 3 } }),
      makeMovie({ id: "2", title: "Heat", userScores: { a: 8, b: 8, c: 3 } }),
    ];

    const takes = computeHotTakes(works, [alice, bob, cara]);

    expect(takes.map((take) => [take.member.name, take.title, take.gap])).toStrictEqual([
      ["Alice Smith", "Cats", 6.5],
      ["Cara Lee", "Heat", -5],
      ["Bob Jones", "Cats", -4],
    ]);
  });

  it("gives no hot take to a member who always agreed", () => {
    const works = [makeMovie({ id: "1", userScores: { a: 7, b: 7 } })];

    expect(computeHotTakes(works, [alice, bob])).toStrictEqual([]);
  });

  it("skips works nobody else scored", () => {
    const works = [makeMovie({ id: "1", userScores: { a: 1 } })];

    expect(computeHotTakes(works, [alice, bob])).toStrictEqual([]);
  });
});

describe("computeClosestMatches", () => {
  it("lists a pair who picked each other once", () => {
    const works = ["1", "2", "3"].map((id) => makeMovie({ id, userScores: { a: 8, b: 7, c: 2 } }));

    const matches = computeClosestMatches(works, [alice, bob, cara]);

    expect(matches.map((m) => [m.member.name, m.match.name, m.mutual])).toStrictEqual([
      ["Alice Smith", "Bob Jones", true],
      ["Cara Lee", "Bob Jones", false],
    ]);
  });
});
