import { ClubType, WorkType } from "../../../../lib/types/generated/db";
import { STAT_WIDGETS, type StatWidgetContext } from "../statisticsWidgets";
import type { BookData, MovieData } from "../types";

/**
 * The widget registry replaced a pile of `v-if="isMovieClub"` branches in
 * InsightsView (see code-quality.md → Club-Type Variation). These tests guard
 * the properties that made that refactor safe: every club type is covered, keys
 * stay unique for the `v-for`, media-specific widgets stay on their own type,
 * and the visibility gates fire at the documented member counts.
 */

function context(overrides: Partial<StatWidgetContext> = {}): StatWidgetContext {
  return {
    workData: [],
    movieData: [],
    bookData: [],
    members: [],
    histogramData: [],
    clubType: ClubType.movie,
    ...overrides,
  };
}

const statsBase = {
  title: "A Work",
  createdDate: "2024-05-01T00:00:00.000Z",
  externalId: "1",
  imageUrl: undefined,
  average: 8,
  userScores: {},
  scores: {},
  dateWatched: "May 1, 2024",
};

const movie: MovieData = {
  ...statsBase,
  id: "m1",
  type: WorkType.movie,
  genres: [],
  production_companies: [],
  production_countries: [],
  externalData: {
    kind: "movie",
    castNames: [],
    directors: [],
    genres: [],
    production_companies: [],
    production_countries: [],
  },
};

const book: BookData = { ...statsBase, id: "b1", type: WorkType.book };

function membersOf(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: String(i + 1),
    email: `member${i + 1}@test.com`,
    name: `Member ${i + 1}`,
  }));
}

/** Keys visible for a club of `memberCount` members. */
function visibleKeys(clubType: ClubType, memberCount: number) {
  const ctx = context({ clubType, members: membersOf(memberCount) });
  return STAT_WIDGETS[clubType].filter((w) => w.visible?.(ctx) ?? true).map((w) => w.key);
}

describe("STAT_WIDGETS", () => {
  it("covers every club type", () => {
    // Typed as Record<ClubType, …>, so a new club type must appear here.
    for (const clubType of Object.values(ClubType)) {
      expect(STAT_WIDGETS[clubType].length).toBeGreaterThan(0);
    }
  });

  it("uses a unique key per widget within each club type", () => {
    for (const clubType of Object.values(ClubType)) {
      const keys = STAT_WIDGETS[clubType].map((widget) => widget.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it("keeps movie-only widgets out of the book club page", () => {
    const bookKeys = visibleKeys(ClubType.book, 5);

    expect(bookKeys).not.toContain("genres");
    expect(bookKeys).not.toContain("people");
    expect(bookKeys).not.toContain("tmdb-deviation");
  });

  it("keeps book-only widgets out of the movie club page", () => {
    const movieKeys = visibleKeys(ClubType.movie, 5);

    expect(movieKeys).not.toContain("subjects");
    expect(movieKeys).not.toContain("authors");
  });

  it("shows the score-only widgets to both club types", () => {
    const shared = ["stats", "club-records", "score-charts", "activity", "era", "club-consensus"];

    for (const clubType of Object.values(ClubType)) {
      expect(visibleKeys(clubType, 5)).toEqual(expect.arrayContaining(shared));
    }
  });

  it("hides every comparison widget from a solo club", () => {
    const keys = visibleKeys(ClubType.movie, 1);

    expect(keys).not.toContain("reviewer-leaderboard");
    expect(keys).not.toContain("member-outliers");
    expect(keys).not.toContain("taste-similarity");
  });

  it("shows two-member comparisons at two members but holds taste similarity back", () => {
    const keys = visibleKeys(ClubType.movie, 2);

    expect(keys).toContain("reviewer-leaderboard");
    expect(keys).toContain("member-outliers");
    // Similarity between exactly two members is a single pair — not a ranking.
    expect(keys).not.toContain("taste-similarity");
  });

  it("shows taste similarity once there are more than two members", () => {
    expect(visibleKeys(ClubType.movie, 3)).toContain("taste-similarity");
  });

  it("hands movie widgets the movie slice and book widgets the book slice", () => {
    const movieData = [movie];
    const bookData = [book];
    const ctx = context({ movieData, bookData });

    const genres = STAT_WIDGETS[ClubType.movie].find((w) => w.key === "genres");
    expect(genres?.props(ctx)).toMatchObject({ movieData });

    const subjects = STAT_WIDGETS[ClubType.book].find((w) => w.key === "subjects");
    expect(subjects?.props(ctx)).toMatchObject({ bookData });
  });

  it("passes the club type down to widgets whose copy varies by media", () => {
    const ctx = context({ clubType: ClubType.book });

    const stats = STAT_WIDGETS[ClubType.book].find((w) => w.key === "stats");
    expect(stats?.props(ctx)).toMatchObject({ clubType: ClubType.book });
  });

  it("gives the score histogram widget the members it colours series by", () => {
    const members = membersOf(3);
    const histogramData = [{ bin: 0 }];
    const ctx = context({ members, histogramData });

    const charts = STAT_WIDGETS[ClubType.movie].find((w) => w.key === "score-charts");
    expect(charts?.props(ctx)).toMatchObject({ members, histogramData });
  });
});
