import {
  CLUB_SECTIONS,
  isClubSection,
  isSectionVisible,
  sectionNameForRoute,
} from "../clubSections";
import { ClubType } from "@/../lib/types/generated/db";

const section = (name: string) => {
  const found = CLUB_SECTIONS.find((candidate) => candidate.name === name);
  if (!found) throw new Error(`No club section named ${name}`);
  return found;
};

const awards = section("Awards");
const reviews = section("Reviews");

describe("clubSections", () => {
  it("gives Reviews and Statistics different icons", () => {
    expect(reviews.icon).not.toBe(section("Statistics").icon);
  });

  it("recognises only section route names", () => {
    expect(isClubSection("Watchlists")).toBe(true);
    expect(isClubSection("ClubSettings")).toBe(false);
    expect(isClubSection(undefined)).toBe(false);
  });

  it("is the four tabs of the bar, in order", () => {
    expect(CLUB_SECTIONS.map((candidate) => candidate.name)).toEqual([
      "Reviews",
      "Watchlists",
      "Statistics",
      "Awards",
    ]);
  });

  it("no longer treats the club page as a section", () => {
    expect(isClubSection("Club")).toBe(false);
  });

  describe("isSectionVisible", () => {
    it("always shows unconditional sections", () => {
      expect(isSectionVisible(reviews, undefined, undefined)).toBe(true);
      expect(isSectionVisible(reviews, ClubType.book, false)).toBe(true);
    });

    it("shows awards only to movie clubs with the feature on", () => {
      expect(isSectionVisible(awards, ClubType.movie, true)).toBe(true);
      expect(isSectionVisible(awards, ClubType.movie, false)).toBe(false);
      expect(isSectionVisible(awards, ClubType.book, true)).toBe(false);
    });

    it("hides awards while the club is still loading", () => {
      expect(isSectionVisible(awards, undefined, undefined)).toBe(false);
    });
  });

  describe("sectionNameForRoute", () => {
    it("resolves a nested route to the section it lives under", () => {
      const route = { matched: [{ name: undefined }, { name: "Awards" }, { name: "AwardsYear" }] };

      expect(sectionNameForRoute(route as never)).toBe("Awards");
    });

    it("returns null for club routes outside the section bar", () => {
      const route = { matched: [{ name: undefined }, { name: "ClubSettings" }] };

      expect(sectionNameForRoute(route as never)).toBeNull();
    });
  });
});
