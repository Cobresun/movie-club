import {
  getLastClubSection,
  getLastClubSlug,
  rememberClubSection,
  resolveDefaultClubSlug,
  setLastClubSection,
  setLastClubSlug,
} from "../composables/useLastClubSlug";
import { ClubType } from "@/../lib/types/generated/db";

const club = (slug: string) => ({
  clubId: slug,
  clubName: slug,
  slug,
  slugUpdatedAt: undefined,
  type: ClubType.movie,
});

beforeEach(() => {
  localStorage.clear();
});

describe("last club slug", () => {
  it("prefers the last visited club when the member is still in it", () => {
    setLastClubSlug("second");

    expect(resolveDefaultClubSlug([club("first"), club("second")])).toBe("second");
  });

  it("falls back to the first club when the last one is gone", () => {
    setLastClubSlug("left-this-one");

    expect(resolveDefaultClubSlug([club("first")])).toBe("first");
    expect(getLastClubSlug()).toBe("left-this-one");
  });

  it("has no default when the member has no clubs", () => {
    expect(resolveDefaultClubSlug([])).toBeNull();
  });
});

describe("last club section", () => {
  it("defaults to Reviews before anything is stored", () => {
    expect(getLastClubSection("a-club")).toBe("Reviews");
  });

  it("remembers a section per club", () => {
    setLastClubSection("a-club", "Statistics");
    setLastClubSection("b-club", "Watchlists");

    expect(getLastClubSection("a-club")).toBe("Statistics");
    expect(getLastClubSection("b-club")).toBe("Watchlists");
  });

  it("ignores route names that are not sections", () => {
    setLastClubSection("a-club", "ClubSettings");

    expect(getLastClubSection("a-club")).toBe("Reviews");
  });

  it("falls back to the default for a section that no longer exists", () => {
    localStorage.setItem("lastClubSection", JSON.stringify({ "a-club": "Club" }));

    expect(getLastClubSection("a-club")).toBe("Reviews");
  });

  it("falls back to the default when the stored value is unusable", () => {
    localStorage.setItem("lastClubSection", "not json");

    expect(getLastClubSection("a-club")).toBe("Reviews");
  });
});

describe("rememberClubSection", () => {
  const route = (clubSlug: string | undefined, ...names: (string | undefined)[]) =>
    ({
      params: clubSlug === undefined ? {} : { clubSlug },
      matched: names.map((name) => ({ name })),
    }) as never;

  it("records the section a club navigation landed on", () => {
    rememberClubSection(route("a-club", undefined, "Watchlists"));

    expect(getLastClubSection("a-club")).toBe("Watchlists");
  });

  it("records the parent section of a nested route", () => {
    rememberClubSection(route("a-club", undefined, "Awards", "AwardsYear"));

    expect(getLastClubSection("a-club")).toBe("Awards");
  });

  it("leaves the stored section alone for routes outside the bar", () => {
    setLastClubSection("a-club", "Statistics");

    rememberClubSection(route("a-club", undefined, "ClubSettings"));

    expect(getLastClubSection("a-club")).toBe("Statistics");
  });

  it("ignores navigations with no club", () => {
    rememberClubSection(route(undefined, "Profile"));

    expect(getLastClubSection("a-club")).toBe("Reviews");
  });
});
