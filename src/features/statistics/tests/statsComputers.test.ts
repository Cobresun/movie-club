import { ensure } from "../../../../lib/checks/checks.js";
import type { DetailedBookData } from "../../../../lib/types/book";
import type { Member } from "../../../../lib/types/club";
import { WorkType } from "../../../../lib/types/generated/db";
import type { DetailedMovieData } from "../../../../lib/types/movie";
import {
  computeClubRecords,
  computeCumulativeCounts,
  computeGenreStats,
  computeGuiltyPleasures,
  computeHighestRatedByYear,
  computeMemberLeaderboard,
  computeMonthlyActivity,
  computePublishDecadeStats,
  computeScoreVariance,
  computeSubjectReadCounts,
  computeSubjectStats,
  computeTasteSimilarity,
  computeTopAuthors,
  computeTopDirectors,
} from "../statsComputers";
import type { BookData, MovieData } from "../types";

function p(name: string): { name: string; profilePath: string | null } {
  return { name, profilePath: null };
}

function makeExternalData(overrides: Partial<DetailedMovieData> = {}): DetailedMovieData {
  return {
    kind: "movie",
    actors: [],
    castNames: [],
    majorCastNames: [],
    adult: false,
    backdrop_path: "",
    budget: 0,
    directors: [],
    genres: [],
    homepage: "",
    id: 1,
    imdb_id: "",
    original_language: "en",
    original_title: "",
    overview: "",
    popularity: 0,
    poster_path: "",
    production_companies: [],
    production_countries: [],
    release_date: "2024-01-01",
    revenue: 0,
    runtime: 120,
    spoken_languages: [],
    status: "Released",
    tagline: "",
    title: "",
    video: false,
    vote_average: 7,
    vote_count: 100,
    ...overrides,
  };
}

function makeMovie(overrides: Partial<MovieData> = {}): MovieData {
  return {
    id: "1",
    type: WorkType.movie,
    title: "Test Movie",
    createdDate: "2024-01-01T00:00:00.000Z",
    externalId: undefined,
    imageUrl: undefined,
    genres: [],
    production_companies: [],
    production_countries: [],
    average: 7,
    userScores: {},
    scores: {},
    externalData: makeExternalData(),
    dateWatched: "1/1/2024",
    ...overrides,
  };
}

function makeBookData(overrides: Partial<DetailedBookData> = {}): DetailedBookData {
  return {
    kind: "book",
    title: "Test Book",
    authors: [],
    subjects: [],
    ...overrides,
  };
}

// No externalData by default: book statistics are score-only, so a book
// review without Google Books metadata still counts.
function makeBook(overrides: Partial<BookData> = {}): BookData {
  return {
    id: "b1",
    type: WorkType.book,
    title: "Test Book",
    createdDate: "2024-01-01T00:00:00.000Z",
    externalId: undefined,
    imageUrl: undefined,
    average: 7,
    userScores: {},
    scores: {},
    dateWatched: "1/1/2024",
    ...overrides,
  };
}

function makeMember(overrides: Partial<Member> = {}): Member {
  return {
    id: "m1",
    email: "test@test.com",
    name: "Test User",
    image: "",
    role: "member",
    ...overrides,
  };
}

// ---------- computeGenreStats ----------

describe("computeGenreStats", () => {
  it("returns empty arrays for empty movie list", () => {
    const result = computeGenreStats([]);
    expect(result.mostLoved).toEqual([]);
    expect(result.leastLoved).toEqual([]);
  });

  it("excludes genres with fewer than 2 movies", () => {
    const movies = [
      makeMovie({ genres: ["Action"], average: 9 }),
      makeMovie({ genres: ["Comedy"], average: 5 }),
    ];
    const result = computeGenreStats(movies);
    expect(result.mostLoved).toEqual([]);
    expect(result.leastLoved).toEqual([]);
  });

  it("includes genres with 2 or more movies", () => {
    const movies = [
      makeMovie({ genres: ["Action"], average: 8 }),
      makeMovie({ genres: ["Action"], average: 6 }),
    ];
    const result = computeGenreStats(movies);
    expect(result.mostLoved).toHaveLength(1);
    expect(result.mostLoved[0].genre).toBe("Action");
    expect(result.mostLoved[0].averageScore).toBe(7);
    expect(result.mostLoved[0].count).toBe(2);
  });

  it("returns top 3 most loved and bottom 3 least loved sorted correctly", () => {
    const genres = ["A", "B", "C", "D", "E"];
    const movies = genres.flatMap((genre, i) => [
      makeMovie({ genres: [genre], average: (i + 1) * 2 }),
      makeMovie({ genres: [genre], average: (i + 1) * 2 }),
    ]);

    const result = computeGenreStats(movies);

    expect(result.mostLoved).toHaveLength(3);
    expect(result.mostLoved[0].genre).toBe("E");
    expect(result.mostLoved[1].genre).toBe("D");
    expect(result.mostLoved[2].genre).toBe("C");

    expect(result.leastLoved).toHaveLength(3);
    expect(result.leastLoved[0].genre).toBe("A");
    expect(result.leastLoved[1].genre).toBe("B");
    expect(result.leastLoved[2].genre).toBe("C");
  });

  it("uses member-specific scores when memberId is provided", () => {
    const movies = [
      makeMovie({
        genres: ["Action"],
        average: 5,
        userScores: { m1: 9, m2: 1 },
      }),
      makeMovie({
        genres: ["Action"],
        average: 5,
        userScores: { m1: 7, m2: 3 },
      }),
    ];

    const withMember = computeGenreStats(movies, "m1");
    expect(withMember.mostLoved[0].averageScore).toBe(8);

    const withAverage = computeGenreStats(movies);
    expect(withAverage.mostLoved[0].averageScore).toBe(5);
  });

  it("includes movies with legitimate score of 0", () => {
    const movies = [
      makeMovie({ genres: ["Horror"], average: 0 }),
      makeMovie({ genres: ["Horror"], average: 8 }),
      makeMovie({ genres: ["Horror"], average: 6 }),
    ];
    const result = computeGenreStats(movies);
    expect(result.mostLoved[0].count).toBe(3);
    expect(result.mostLoved[0].averageScore).toBeCloseTo(4.67, 2);
  });

  it("skips movies with undefined score", () => {
    const movies = [
      makeMovie({ genres: ["Horror"], average: 8, userScores: { m1: 8 } }),
      makeMovie({
        genres: ["Horror"],
        average: 6,
        userScores: { m1: undefined },
      }),
      makeMovie({ genres: ["Horror"], average: 4, userScores: { m1: 4 } }),
    ];
    const result = computeGenreStats(movies, "m1");
    expect(result.mostLoved[0].count).toBe(2);
    expect(result.mostLoved[0].averageScore).toBe(6);
  });

  it("skips movies with undefined member score when filtering by member", () => {
    const movies = [
      makeMovie({ genres: ["Drama"], userScores: { m1: 8 } }),
      makeMovie({ genres: ["Drama"], userScores: {} }),
      makeMovie({ genres: ["Drama"], userScores: { m1: 6 } }),
    ];
    const result = computeGenreStats(movies, "m1");
    expect(result.mostLoved[0].count).toBe(2);
    expect(result.mostLoved[0].averageScore).toBe(7);
  });

  it("handles movies with multiple genres", () => {
    const movies = [
      makeMovie({ genres: ["Action", "Comedy"], average: 8 }),
      makeMovie({ genres: ["Action", "Drama"], average: 6 }),
      makeMovie({ genres: ["Comedy", "Drama"], average: 4 }),
    ];
    const result = computeGenreStats(movies);
    const genreMap = Object.fromEntries(
      [...result.mostLoved, ...result.leastLoved].map((g) => [g.genre, g.averageScore]),
    );
    expect(genreMap["Action"]).toBe(7);
    expect(genreMap["Comedy"]).toBe(6);
    expect(genreMap["Drama"]).toBe(5);
  });
});

// ---------- computeMemberLeaderboard ----------

describe("computeMemberLeaderboard", () => {
  it("returns empty array for empty movie data", () => {
    const members = [makeMember({ id: "m1" })];
    const result = computeMemberLeaderboard([], members);
    expect(result).toEqual([]);
  });

  it("returns empty array for empty members", () => {
    const movies = [makeMovie({ userScores: { m1: 8 } })];
    const result = computeMemberLeaderboard(movies, []);
    expect(result).toEqual([]);
  });

  it("calculates average scores correctly", () => {
    const members = [makeMember({ id: "m1", name: "Alice" })];
    const movies = [
      makeMovie({ userScores: { m1: 8 } }),
      makeMovie({ userScores: { m1: 6 } }),
      makeMovie({ userScores: { m1: 10 } }),
    ];
    const result = computeMemberLeaderboard(movies, members);
    expect(result).toHaveLength(1);
    expect(result[0].averageScore).toBe(8);
    expect(result[0].reviewCount).toBe(3);
  });

  it("assigns 'The Softie' to highest and 'The Hater' to lowest", () => {
    const members = [
      makeMember({ id: "m1", name: "Nice" }),
      makeMember({ id: "m2", name: "Mean" }),
      makeMember({ id: "m3", name: "Mid" }),
    ];
    const movies = [
      makeMovie({ userScores: { m1: 9, m2: 3, m3: 6 } }),
      makeMovie({ userScores: { m1: 8, m2: 4, m3: 5 } }),
    ];
    const result = computeMemberLeaderboard(movies, members);
    expect(result[0].member.name).toBe("Nice");
    expect(result[0].title).toBe("The Softie");
    expect(result[result.length - 1].member.name).toBe("Mean");
    expect(result[result.length - 1].title).toBe("The Hater");
  });

  it("single member gets no title", () => {
    const members = [makeMember({ id: "m1" })];
    const movies = [makeMovie({ userScores: { m1: 7 } })];
    const result = computeMemberLeaderboard(movies, members);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBeUndefined();
  });

  it("filters out members with no reviews", () => {
    const members = [
      makeMember({ id: "m1", name: "Active" }),
      makeMember({ id: "m2", name: "Inactive" }),
    ];
    const movies = [makeMovie({ userScores: { m1: 7 } })];
    const result = computeMemberLeaderboard(movies, members);
    expect(result).toHaveLength(1);
    expect(result[0].member.name).toBe("Active");
  });

  it("handles partial reviews (member missing scores on some movies)", () => {
    const members = [
      makeMember({ id: "m1", name: "Alice" }),
      makeMember({ id: "m2", name: "Bob" }),
    ];
    const movies = [
      makeMovie({ userScores: { m1: 8, m2: 6 } }),
      makeMovie({ userScores: { m1: 10, m2: undefined } }),
      makeMovie({ userScores: { m1: undefined, m2: 4 } }),
    ];
    const result = computeMemberLeaderboard(movies, members);
    const alice = ensure(result.find((e) => e.member.name === "Alice"));
    const bob = ensure(result.find((e) => e.member.name === "Bob"));
    expect(alice.reviewCount).toBe(2);
    expect(alice.averageScore).toBe(9);
    expect(bob.reviewCount).toBe(2);
    expect(bob.averageScore).toBe(5);
  });

  it("filters out NaN scores", () => {
    const members = [makeMember({ id: "m1" })];
    const movies = [makeMovie({ userScores: { m1: NaN } }), makeMovie({ userScores: { m1: 8 } })];
    const result = computeMemberLeaderboard(movies, members);
    expect(result[0].reviewCount).toBe(1);
    expect(result[0].averageScore).toBe(8);
  });

  it("sorts by average score descending", () => {
    const members = [
      makeMember({ id: "m1", name: "Low" }),
      makeMember({ id: "m2", name: "High" }),
      makeMember({ id: "m3", name: "Mid" }),
    ];
    const movies = [
      makeMovie({ userScores: { m1: 3, m2: 9, m3: 6 } }),
      makeMovie({ userScores: { m1: 4, m2: 8, m3: 5 } }),
    ];
    const result = computeMemberLeaderboard(movies, members);
    expect(result.map((e) => e.member.name)).toEqual(["High", "Mid", "Low"]);
  });
});

// ---------- computeTasteSimilarity ----------

describe("computeTasteSimilarity", () => {
  it("returns nulls with fewer than 2 members", () => {
    const result = computeTasteSimilarity([], [makeMember()]);
    expect(result.mostSimilar).toBeNull();
    expect(result.leastSimilar).toBeNull();
  });

  it("returns nulls when no pair shares 3+ reviews", () => {
    const members = [makeMember({ id: "m1" }), makeMember({ id: "m2" })];
    const movies = [
      makeMovie({ userScores: { m1: 7, m2: 8 } }),
      makeMovie({ userScores: { m1: 6, m2: 5 } }),
    ];
    const result = computeTasteSimilarity(movies, members);
    expect(result.mostSimilar).toBeNull();
    expect(result.leastSimilar).toBeNull();
  });

  it("calculates 100% similarity for identical scores", () => {
    const members = [makeMember({ id: "m1", name: "A" }), makeMember({ id: "m2", name: "B" })];
    const movies = [
      makeMovie({ userScores: { m1: 7, m2: 7 } }),
      makeMovie({ userScores: { m1: 5, m2: 5 } }),
      makeMovie({ userScores: { m1: 9, m2: 9 } }),
    ];
    const result = computeTasteSimilarity(movies, members);
    const mostSimilar = ensure(result.mostSimilar);
    expect(mostSimilar.similarityPercent).toBe(100);
    expect(mostSimilar.avgDifference).toBe(0);
  });

  it("calculates similarity correctly for different scores", () => {
    const members = [makeMember({ id: "m1" }), makeMember({ id: "m2" })];
    // Differences: 2, 2, 2 → avg diff = 2 → similarity = (1 - 2/10) * 100 = 80%
    const movies = [
      makeMovie({ userScores: { m1: 8, m2: 6 } }),
      makeMovie({ userScores: { m1: 5, m2: 7 } }),
      makeMovie({ userScores: { m1: 9, m2: 7 } }),
    ];
    const result = computeTasteSimilarity(movies, members);
    const mostSimilar = ensure(result.mostSimilar);
    expect(mostSimilar.similarityPercent).toBe(80);
    expect(mostSimilar.avgDifference).toBe(2);
  });

  it("identifies most and least similar pairs among 3+ members", () => {
    const members = [
      makeMember({ id: "m1", name: "A" }),
      makeMember({ id: "m2", name: "B" }),
      makeMember({ id: "m3", name: "C" }),
    ];
    // A and B: close scores. A and C / B and C: far apart.
    const movies = [
      makeMovie({ userScores: { m1: 7, m2: 7, m3: 1 } }),
      makeMovie({ userScores: { m1: 8, m2: 8, m3: 2 } }),
      makeMovie({ userScores: { m1: 6, m2: 6, m3: 1 } }),
    ];
    const result = computeTasteSimilarity(movies, members);
    const mostSimilar = ensure(result.mostSimilar);
    const leastSimilar = ensure(result.leastSimilar);
    expect(mostSimilar.memberA.name).toBe("A");
    expect(mostSimilar.memberB.name).toBe("B");
    expect(mostSimilar.similarityPercent).toBe(100);

    // Least similar should be one of the pairs involving C
    const leastNames = [leastSimilar.memberA.name, leastSimilar.memberB.name];
    expect(leastNames).toContain("C");
  });

  it("returns best and worst agreements sorted correctly", () => {
    const members = [makeMember({ id: "m1" }), makeMember({ id: "m2" })];
    const movies = [
      makeMovie({ title: "Close", userScores: { m1: 7, m2: 7 } }),
      makeMovie({ title: "Medium", userScores: { m1: 5, m2: 8 } }),
      makeMovie({ title: "Far", userScores: { m1: 1, m2: 9 } }),
    ];
    const result = computeTasteSimilarity(movies, members);
    const pair = ensure(result.mostSimilar);

    // Best agreements: smallest difference first
    expect(pair.bestAgreements[0].title).toBe("Close");
    expect(pair.bestAgreements[0].difference).toBe(0);

    // Worst agreements: largest difference first
    expect(pair.worstAgreements[0].title).toBe("Far");
    expect(pair.worstAgreements[0].difference).toBe(8);
  });

  it("skips members with NaN or undefined scores for shared count", () => {
    const members = [makeMember({ id: "m1" }), makeMember({ id: "m2" })];
    const movies = [
      makeMovie({ userScores: { m1: 7, m2: 7 } }),
      makeMovie({ userScores: { m1: 5, m2: NaN } }),
      makeMovie({ userScores: { m1: 8, m2: 6 } }),
      makeMovie({ userScores: { m1: 9, m2: 4 } }),
    ];
    const result = computeTasteSimilarity(movies, members);
    expect(ensure(result.mostSimilar).sharedCount).toBe(3);
  });

  it("excludes members with undefined scores from shared count", () => {
    const members = [makeMember({ id: "m1" }), makeMember({ id: "m2" })];
    const movies = [
      makeMovie({ userScores: { m1: 7, m2: 7 } }),
      makeMovie({ userScores: { m1: 5, m2: undefined } }),
      makeMovie({ userScores: { m1: 8, m2: 6 } }),
      makeMovie({ userScores: { m1: 9, m2: 4 } }),
    ];
    const result = computeTasteSimilarity(movies, members);
    expect(ensure(result.mostSimilar).sharedCount).toBe(3);
  });

  it("with only 2 members, mostSimilar and leastSimilar are the same pair", () => {
    const members = [makeMember({ id: "m1" }), makeMember({ id: "m2" })];
    const movies = [
      makeMovie({ userScores: { m1: 7, m2: 5 } }),
      makeMovie({ userScores: { m1: 8, m2: 6 } }),
      makeMovie({ userScores: { m1: 6, m2: 4 } }),
    ];
    const result = computeTasteSimilarity(movies, members);
    const mostSimilar = ensure(result.mostSimilar);
    const leastSimilar = ensure(result.leastSimilar);
    expect(mostSimilar.memberA.id).toBe(leastSimilar.memberA.id);
    expect(mostSimilar.memberB.id).toBe(leastSimilar.memberB.id);
  });
});

// ---------- computeTopDirectors ----------

describe("computeTopDirectors", () => {
  it("returns empty for empty movie list", () => {
    expect(computeTopDirectors([])).toEqual([]);
  });

  it("includes movies with average 0 (legitimate score)", () => {
    const movies = [
      makeMovie({
        average: 0,
        externalData: makeExternalData({ directors: [p("Spielberg")] }),
      }),
    ];
    const result = computeTopDirectors(movies);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Spielberg");
    expect(result[0].averageScore).toBe(0);
  });

  it("skips movies with no directors", () => {
    const movies = [
      makeMovie({
        average: 8,
        externalData: makeExternalData({ directors: [] }),
      }),
    ];
    expect(computeTopDirectors(movies)).toEqual([]);
  });

  it("accumulates movies per director correctly", () => {
    const movies = [
      makeMovie({
        title: "Movie A",
        average: 8,
        externalData: makeExternalData({ directors: [p("Nolan")] }),
      }),
      makeMovie({
        title: "Movie B",
        average: 6,
        externalData: makeExternalData({ directors: [p("Nolan")] }),
      }),
    ];
    const result = computeTopDirectors(movies);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Nolan");
    expect(result[0].workCount).toBe(2);
    expect(result[0].averageScore).toBe(7);
    expect(result[0].works).toEqual(["Movie A", "Movie B"]);
  });

  it("returns max 5 directors", () => {
    const directors = ["A", "B", "C", "D", "E", "F", "G"];
    const movies = directors.flatMap((dir) => [
      makeMovie({
        average: 7,
        externalData: makeExternalData({ directors: [p(dir)] }),
      }),
      makeMovie({
        average: 7,
        externalData: makeExternalData({ directors: [p(dir)] }),
      }),
    ]);
    expect(computeTopDirectors(movies)).toHaveLength(5);
  });

  it("sorts by movie count first, then by average score", () => {
    const movies = [
      // Director A: 3 movies, avg 5
      makeMovie({
        average: 5,
        externalData: makeExternalData({ directors: [p("A")] }),
      }),
      makeMovie({
        average: 5,
        externalData: makeExternalData({ directors: [p("A")] }),
      }),
      makeMovie({
        average: 5,
        externalData: makeExternalData({ directors: [p("A")] }),
      }),
      // Director B: 2 movies, avg 9
      makeMovie({
        average: 9,
        externalData: makeExternalData({ directors: [p("B")] }),
      }),
      makeMovie({
        average: 9,
        externalData: makeExternalData({ directors: [p("B")] }),
      }),
      // Director C: 2 movies, avg 7
      makeMovie({
        average: 7,
        externalData: makeExternalData({ directors: [p("C")] }),
      }),
      makeMovie({
        average: 7,
        externalData: makeExternalData({ directors: [p("C")] }),
      }),
    ];
    const result = computeTopDirectors(movies);
    expect(result[0].name).toBe("A"); // most movies
    expect(result[1].name).toBe("B"); // same count as C, higher avg
    expect(result[2].name).toBe("C");
  });

  it("handles movies with multiple directors", () => {
    const movies = [
      makeMovie({
        title: "Collab",
        average: 8,
        externalData: makeExternalData({ directors: [p("X"), p("Y")] }),
      }),
      makeMovie({
        title: "Solo X",
        average: 6,
        externalData: makeExternalData({ directors: [p("X")] }),
      }),
    ];
    const result = computeTopDirectors(movies);
    const x = ensure(result.find((d) => d.name === "X"));
    const y = ensure(result.find((d) => d.name === "Y"));
    expect(x.workCount).toBe(2);
    expect(x.averageScore).toBe(7);
    expect(y.workCount).toBe(1);
    expect(y.averageScore).toBe(8);
  });
});

// ---------- computeGuiltyPleasures ----------

describe("computeGuiltyPleasures", () => {
  it("returns empty array for empty movie list", () => {
    const members = [makeMember({ id: "m1" })];
    const result = computeGuiltyPleasures([], members);
    expect(result).toEqual([]);
  });

  it("returns empty array when no scores are 2+ above average", () => {
    const members = [
      makeMember({ id: "m1", name: "Alice" }),
      makeMember({ id: "m2", name: "Bob" }),
    ];
    const movies = [
      makeMovie({ average: 7, userScores: { m1: 7.5, m2: 6.5 } }),
      makeMovie({ average: 5, userScores: { m1: 5.5, m2: 4.5 } }),
    ];
    const result = computeGuiltyPleasures(movies, members);
    expect(result).toEqual([]);
  });

  it("includes movie where exactly one member is 2+ above average", () => {
    const members = [
      makeMember({ id: "m1", name: "Alice" }),
      makeMember({ id: "m2", name: "Bob" }),
    ];
    const movies = [
      makeMovie({
        title: "Guilty Movie",
        average: 5,
        userScores: { m1: 8, m2: 2 },
      }),
    ];
    const result = computeGuiltyPleasures(movies, members);
    expect(result).toHaveLength(1);
    expect(result[0].member.name).toBe("Alice");
    expect(result[0].movies).toHaveLength(1);
    expect(result[0].movies[0].title).toBe("Guilty Movie");
    expect(result[0].movies[0].memberScore).toBe(8);
    expect(result[0].movies[0].clubAverage).toBe(5);
    expect(result[0].movies[0].difference).toBe(3);
  });

  it("excludes movie where two members are both 2+ above average", () => {
    const members = [
      makeMember({ id: "m1", name: "Alice" }),
      makeMember({ id: "m2", name: "Bob" }),
      makeMember({ id: "m3", name: "Carol" }),
    ];
    const movies = [
      makeMovie({
        title: "Both Loved",
        average: 5,
        userScores: { m1: 8, m2: 7, m3: 0 },
      }),
    ];
    const result = computeGuiltyPleasures(movies, members);
    expect(result).toEqual([]);
  });

  it("skips movies with fewer than 2 scores", () => {
    const members = [
      makeMember({ id: "m1", name: "Alice" }),
      makeMember({ id: "m2", name: "Bob" }),
    ];
    const movies = [
      makeMovie({
        title: "Solo",
        average: 9,
        userScores: { m1: 9 },
      }),
    ];
    const result = computeGuiltyPleasures(movies, members);
    expect(result).toEqual([]);
  });

  it("skips members with undefined or NaN scores", () => {
    const members = [
      makeMember({ id: "m1", name: "Alice" }),
      makeMember({ id: "m2", name: "Bob" }),
      makeMember({ id: "m3", name: "Carol" }),
    ];
    const movies = [
      makeMovie({
        title: "Test",
        average: 4,
        userScores: { m1: undefined, m2: NaN, m3: 7 },
      }),
    ];
    const result = computeGuiltyPleasures(movies, members);
    // Only m3 has a valid score, but need 2+ valid scores
    expect(result).toEqual([]);
  });

  it("sorts movies by difference descending within each member", () => {
    const members = [
      makeMember({ id: "m1", name: "Alice" }),
      makeMember({ id: "m2", name: "Bob" }),
    ];
    const movies = [
      makeMovie({
        title: "Small Gap",
        average: 5,
        userScores: { m1: 7, m2: 3 },
      }),
      makeMovie({
        title: "Big Gap",
        average: 4,
        userScores: { m1: 9, m2: -1 },
      }),
    ];
    const result = computeGuiltyPleasures(movies, members);
    expect(result).toHaveLength(1);
    expect(result[0].movies[0].title).toBe("Big Gap");
    expect(result[0].movies[1].title).toBe("Small Gap");
  });

  it("sorts members by number of guilty pleasures descending", () => {
    const members = [
      makeMember({ id: "m1", name: "Alice" }),
      makeMember({ id: "m2", name: "Bob" }),
      makeMember({ id: "m3", name: "Carol" }),
    ];
    const movies = [
      makeMovie({
        title: "A1",
        average: 4,
        userScores: { m1: 7, m2: 2, m3: 3 },
      }),
      makeMovie({
        title: "B1",
        average: 3,
        userScores: { m1: 2, m2: 6, m3: 1 },
      }),
      makeMovie({
        title: "B2",
        average: 3,
        userScores: { m1: 1, m2: 7, m3: 1 },
      }),
    ];
    const result = computeGuiltyPleasures(movies, members);
    expect(result[0].member.name).toBe("Bob");
    expect(result[0].movies).toHaveLength(2);
    expect(result[1].member.name).toBe("Alice");
    expect(result[1].movies).toHaveLength(1);
  });

  it("limits each member to top 5 movies", () => {
    const members = [
      makeMember({ id: "m1", name: "Alice" }),
      makeMember({ id: "m2", name: "Bob" }),
    ];
    const movies = Array.from({ length: 7 }, (_, i) =>
      makeMovie({
        id: `movie-${i}`,
        title: `Movie ${i}`,
        average: 4,
        userScores: { m1: 7 + i * 0.1, m2: 1 },
      }),
    );
    const result = computeGuiltyPleasures(movies, members);
    expect(result).toHaveLength(1);
    expect(result[0].movies).toHaveLength(5);
    // Should keep the top 5 by difference (highest scores first)
    expect(result[0].movies[0].title).toBe("Movie 6");
  });

  it("includes movie at exactly 2 point threshold", () => {
    const members = [
      makeMember({ id: "m1", name: "Alice" }),
      makeMember({ id: "m2", name: "Bob" }),
    ];
    const movies = [
      makeMovie({
        title: "Exact Threshold",
        average: 5,
        userScores: { m1: 7, m2: 3 },
      }),
    ];
    const result = computeGuiltyPleasures(movies, members);
    expect(result).toHaveLength(1);
    expect(result[0].movies[0].difference).toBe(2);
  });
});

// ---------- computeScoreVariance ----------

describe("computeScoreVariance", () => {
  function makeReviewedMovie(
    index: number,
    scores: Record<string, number>,
    title = `Movie ${index}`,
  ): MovieData {
    const day = String(index).padStart(2, "0");
    return makeMovie({
      id: String(index),
      title,
      createdDate: `2024-01-${day}T00:00:00.000Z`,
      userScores: scores,
    });
  }

  it("returns empty array for empty movie list", () => {
    expect(computeScoreVariance([])).toEqual([]);
  });

  it("returns empty array when no movie has at least 2 scores", () => {
    const movies = [
      makeReviewedMovie(1, { m1: 8 }),
      makeReviewedMovie(2, { m1: 6 }),
      makeReviewedMovie(3, { m1: 7 }),
      makeReviewedMovie(4, { m1: 9 }),
      makeReviewedMovie(5, { m1: 5 }),
    ];
    expect(computeScoreVariance(movies)).toEqual([]);
  });

  it("skips movies missing createdDate or with invalid date", () => {
    const movies = [
      makeReviewedMovie(1, { m1: 8, m2: 6 }),
      makeMovie({
        id: "bad",
        createdDate: "",
        userScores: { m1: 7, m2: 7 },
      }),
      makeMovie({
        id: "bad2",
        createdDate: "not a date",
        userScores: { m1: 7, m2: 7 },
      }),
    ];
    // Only one valid movie => below the 5-point minimum window, so no points
    expect(computeScoreVariance(movies)).toEqual([]);
  });

  it("produces a rolling spread that drops when members agree more", () => {
    // First 5 movies: wide spread (8 vs 2). Last 5: tight spread (7 vs 7).
    const movies = [
      ...Array.from({ length: 5 }, (_, i) => makeReviewedMovie(i + 1, { m1: 8, m2: 2 })),
      ...Array.from({ length: 5 }, (_, i) => makeReviewedMovie(i + 6, { m1: 7, m2: 7 })),
    ];

    const points = computeScoreVariance(movies);

    expect(points.length).toBeGreaterThan(0);
    const first = points[0];
    const last = points[points.length - 1];
    // Population std dev for {8,2} is 3; for {7,7} is 0.
    expect(first.rollingStdDev).toBeGreaterThan(last.rollingStdDev);
    expect(last.rollingStdDev).toBe(0);
  });

  it("computes per-movie spread as population std dev", () => {
    const movies = Array.from({ length: 5 }, (_, i) => makeReviewedMovie(i + 1, { m1: 8, m2: 2 }));
    const points = computeScoreVariance(movies);
    const first = ensure(points[0]);
    expect(first.movieStdDev).toBe(3);
    expect(first.rollingStdDev).toBe(3);
  });

  it("orders points chronologically regardless of input order", () => {
    const movies = [
      makeReviewedMovie(5, { m1: 8, m2: 2 }, "E"),
      makeReviewedMovie(1, { m1: 6, m2: 4 }, "A"),
      makeReviewedMovie(3, { m1: 7, m2: 7 }, "C"),
      makeReviewedMovie(2, { m1: 9, m2: 5 }, "B"),
      makeReviewedMovie(4, { m1: 6, m2: 6 }, "D"),
    ];

    const points = computeScoreVariance(movies);
    expect(points).toHaveLength(1);
    expect(points[0].movieTitle).toBe("E");
    for (let i = 1; i < points.length; i++) {
      expect(points[i].date.getTime()).toBeGreaterThanOrEqual(points[i - 1].date.getTime());
    }
  });
});

// ---------- computeHighestRatedByYear ----------

describe("computeHighestRatedByYear", () => {
  it("returns an empty array for an empty movie list", () => {
    expect(computeHighestRatedByYear([])).toEqual([]);
  });

  it("picks the highest-rated movie for each watched year", () => {
    const movies = [
      makeMovie({
        title: "2023 Low",
        average: 5,
        createdDate: "2023-03-01T00:00:00.000Z",
      }),
      makeMovie({
        title: "2023 High",
        average: 9,
        createdDate: "2023-08-01T00:00:00.000Z",
      }),
      makeMovie({
        title: "2024 Only",
        average: 6,
        createdDate: "2024-01-15T00:00:00.000Z",
      }),
    ];

    const result = computeHighestRatedByYear(movies);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      year: 2024,
      title: "2024 Only",
      average: 6,
      workCount: 1,
    });
    expect(result[1]).toMatchObject({
      year: 2023,
      title: "2023 High",
      average: 9,
      workCount: 2,
    });
  });

  it("sorts results by year descending", () => {
    const movies = [
      makeMovie({ createdDate: "2021-01-01T00:00:00.000Z" }),
      makeMovie({ createdDate: "2025-01-01T00:00:00.000Z" }),
      makeMovie({ createdDate: "2023-01-01T00:00:00.000Z" }),
    ];

    const years = computeHighestRatedByYear(movies).map((e) => e.year);

    expect(years).toEqual([2025, 2023, 2021]);
  });

  it("skips movies with an invalid watched date", () => {
    const movies = [
      makeMovie({ title: "Valid", createdDate: "2024-01-01T00:00:00.000Z" }),
      makeMovie({ title: "Invalid", createdDate: "not-a-date" }),
    ];

    const result = computeHighestRatedByYear(movies);

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Valid");
  });

  it("rounds the average to two decimals", () => {
    const movies = [makeMovie({ average: 8.126, createdDate: "2024-01-01T00:00:00.000Z" })];

    expect(computeHighestRatedByYear(movies)[0].average).toBe(8.13);
  });
});

describe("score-based computers with book data", () => {
  it("computeMemberLeaderboard ranks members from book reviews", () => {
    const books = [
      makeBook({ id: "b1", userScores: { m1: 9, m2: 5 } }),
      makeBook({ id: "b2", userScores: { m1: 7, m2: 3 } }),
    ];
    const members = [
      makeMember({ id: "m1", name: "Alice" }),
      makeMember({ id: "m2", name: "Bob" }),
    ];

    const leaderboard = computeMemberLeaderboard(books, members);

    expect(leaderboard).toHaveLength(2);
    expect(leaderboard[0].member.id).toBe("m1");
    expect(leaderboard[0].averageScore).toBe(8);
    expect(leaderboard[0].title).toBe("The Softie");
    expect(leaderboard[1].averageScore).toBe(4);
    expect(leaderboard[1].title).toBe("The Hater");
  });

  it("computeGuiltyPleasures works for books without external metadata", () => {
    const books = [
      makeBook({
        id: "b1",
        title: "Divisive Book",
        average: 5,
        userScores: { m1: 8, m2: 4, m3: 3 },
      }),
    ];
    const members = [
      makeMember({ id: "m1", name: "Alice" }),
      makeMember({ id: "m2", name: "Bob" }),
      makeMember({ id: "m3", name: "Cleo" }),
    ];

    const entries = computeGuiltyPleasures(books, members);

    expect(entries).toHaveLength(1);
    expect(entries[0].member.id).toBe("m1");
    expect(entries[0].movies[0].title).toBe("Divisive Book");
  });

  it("computeTasteSimilarity compares members across book reviews", () => {
    const books = Array.from({ length: 3 }, (_, i) =>
      makeBook({ id: `b${i}`, userScores: { m1: 7, m2: 7 } }),
    );
    const members = [makeMember({ id: "m1" }), makeMember({ id: "m2" })];

    const { mostSimilar } = computeTasteSimilarity(books, members);

    expect(mostSimilar?.similarityPercent).toBe(100);
    expect(mostSimilar?.sharedCount).toBe(3);
  });
});

// ---------- computeTopAuthors ----------

describe("computeTopAuthors", () => {
  it("returns empty for an empty book list", () => {
    expect(computeTopAuthors([])).toEqual([]);
  });

  it("skips books without external metadata", () => {
    const books = [makeBook({ average: 8 })];
    expect(computeTopAuthors(books)).toEqual([]);
  });

  it("accumulates books per author with no avatar", () => {
    const books = [
      makeBook({
        title: "Book A",
        average: 8,
        externalData: makeBookData({ authors: ["Le Guin"] }),
      }),
      makeBook({
        title: "Book B",
        average: 6,
        externalData: makeBookData({ authors: ["Le Guin"] }),
      }),
    ];
    const result = computeTopAuthors(books);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Le Guin");
    expect(result[0].workCount).toBe(2);
    expect(result[0].averageScore).toBe(7);
    expect(result[0].works).toEqual(["Book A", "Book B"]);
    expect(result[0].profileImageUrl).toBeUndefined();
  });

  it("handles books with multiple authors", () => {
    const books = [
      makeBook({
        title: "Collab",
        average: 8,
        externalData: makeBookData({ authors: ["Gaiman", "Pratchett"] }),
      }),
      makeBook({
        title: "Solo",
        average: 6,
        externalData: makeBookData({ authors: ["Gaiman"] }),
      }),
    ];
    const result = computeTopAuthors(books);
    const gaiman = ensure(result.find((a) => a.name === "Gaiman"));
    const pratchett = ensure(result.find((a) => a.name === "Pratchett"));
    expect(gaiman.workCount).toBe(2);
    expect(gaiman.averageScore).toBe(7);
    expect(pratchett.workCount).toBe(1);
  });

  it("returns at most 5 authors", () => {
    const authors = ["A", "B", "C", "D", "E", "F", "G"];
    const books = authors.flatMap((author) => [
      makeBook({
        average: 7,
        externalData: makeBookData({ authors: [author] }),
      }),
      makeBook({
        average: 7,
        externalData: makeBookData({ authors: [author] }),
      }),
    ]);
    expect(computeTopAuthors(books)).toHaveLength(5);
  });
});

// ---------- computeSubjectStats / computeSubjectReadCounts ----------

describe("computeSubjectStats", () => {
  it("returns empty for an empty book list", () => {
    expect(computeSubjectStats([])).toEqual([]);
  });

  it("excludes subjects read fewer than twice", () => {
    const books = [
      makeBook({
        average: 9,
        externalData: makeBookData({ subjects: ["Fantasy"] }),
      }),
      makeBook({
        average: 5,
        externalData: makeBookData({ subjects: ["History"] }),
      }),
    ];
    expect(computeSubjectStats(books)).toEqual([]);
  });

  it("averages scores for subjects read at least twice", () => {
    const books = [
      makeBook({
        average: 8,
        externalData: makeBookData({ subjects: ["Fantasy"] }),
      }),
      makeBook({
        average: 6,
        externalData: makeBookData({ subjects: ["Fantasy"] }),
      }),
    ];
    const result = computeSubjectStats(books);
    expect(result).toHaveLength(1);
    expect(result[0].subject).toBe("Fantasy");
    expect(result[0].averageScore).toBe(7);
    expect(result[0].count).toBe(2);
  });

  it("uses member-specific scores when a memberId is provided", () => {
    const books = [
      makeBook({
        average: 5,
        userScores: { m1: 9, m2: 1 },
        externalData: makeBookData({ subjects: ["Sci-Fi"] }),
      }),
      makeBook({
        average: 5,
        userScores: { m1: 7, m2: 3 },
        externalData: makeBookData({ subjects: ["Sci-Fi"] }),
      }),
    ];
    expect(computeSubjectStats(books, "m1")[0].averageScore).toBe(8);
    expect(computeSubjectStats(books)[0].averageScore).toBe(5);
  });

  it("caps the result at the top 5 subjects by score", () => {
    const subjects = ["A", "B", "C", "D", "E", "F"];
    const books = subjects.flatMap((subject, i) => [
      makeBook({
        average: i + 1,
        externalData: makeBookData({ subjects: [subject] }),
      }),
      makeBook({
        average: i + 1,
        externalData: makeBookData({ subjects: [subject] }),
      }),
    ]);
    const result = computeSubjectStats(books);
    expect(result).toHaveLength(5);
    expect(result[0].subject).toBe("F");
    expect(result.map((s) => s.subject)).not.toContain("A");
  });
});

describe("computeSubjectReadCounts", () => {
  it("returns empty for an empty book list", () => {
    expect(computeSubjectReadCounts([])).toEqual([]);
  });

  it("counts every subject occurrence, ranked by count", () => {
    const books = [
      makeBook({
        externalData: makeBookData({ subjects: ["Fantasy", "Epic"] }),
      }),
      makeBook({ externalData: makeBookData({ subjects: ["Fantasy"] }) }),
      makeBook({ externalData: makeBookData({ subjects: ["Epic"] }) }),
      makeBook({ externalData: makeBookData({ subjects: ["Fantasy"] }) }),
    ];
    const result = computeSubjectReadCounts(books);
    expect(result[0]).toEqual({ subject: "Fantasy", count: 3 });
    expect(result[1]).toEqual({ subject: "Epic", count: 2 });
  });

  it("caps the result at the top 5 subjects by count", () => {
    const subjects = ["A", "B", "C", "D", "E", "F"];
    const books = subjects.flatMap((subject, i) =>
      Array.from({ length: i + 1 }, () =>
        makeBook({ externalData: makeBookData({ subjects: [subject] }) }),
      ),
    );
    const result = computeSubjectReadCounts(books);
    expect(result).toHaveLength(5);
    expect(result[0].subject).toBe("F");
    expect(result.map((s) => s.subject)).not.toContain("A");
  });
});

// ---------- computePublishDecadeStats ----------

describe("computePublishDecadeStats", () => {
  it("returns empty for an empty book list", () => {
    expect(computePublishDecadeStats([])).toEqual([]);
  });

  it("skips books without a first-publish year", () => {
    const books = [
      makeBook({ average: 8, externalData: makeBookData() }),
      makeBook({ average: 6 }),
    ];
    expect(computePublishDecadeStats(books)).toEqual([]);
  });

  it("groups books into decades by publish year, sorted ascending", () => {
    const books = [
      makeBook({
        average: 8,
        externalData: makeBookData({ firstPublishYear: 1998 }),
      }),
      makeBook({
        average: 6,
        externalData: makeBookData({ firstPublishYear: 1995 }),
      }),
      makeBook({
        average: 9,
        externalData: makeBookData({ firstPublishYear: 2003 }),
      }),
    ];
    const result = computePublishDecadeStats(books);
    expect(result).toEqual([
      { decade: "1990s", averageScore: 7, count: 2 },
      { decade: "2000s", averageScore: 9, count: 1 },
    ]);
  });

  it("uses member-specific scores when a memberId is provided", () => {
    const books = [
      makeBook({
        average: 5,
        userScores: { m1: 9 },
        externalData: makeBookData({ firstPublishYear: 1980 }),
      }),
      makeBook({
        average: 5,
        userScores: { m1: 7 },
        externalData: makeBookData({ firstPublishYear: 1985 }),
      }),
    ];
    expect(computePublishDecadeStats(books, "m1")[0].averageScore).toBe(8);
    expect(computePublishDecadeStats(books)[0].averageScore).toBe(5);
  });
});

// ---------- computeClubRecords ----------

describe("computeClubRecords", () => {
  it("returns no records for fewer than two works", () => {
    expect(computeClubRecords([makeMovie()])).toEqual({
      highest: null,
      lowest: null,
      mostDivisive: null,
    });
  });

  it("finds the highest and lowest rated works", () => {
    const movies = [
      makeMovie({ title: "Best", average: 9.25 }),
      makeMovie({ title: "Middle", average: 6 }),
      makeMovie({ title: "Worst", average: 2.5 }),
    ];

    const records = computeClubRecords(movies);

    expect(records.highest).toMatchObject({ title: "Best", value: 9.25 });
    expect(records.lowest).toMatchObject({ title: "Worst", value: 2.5 });
  });

  it("finds the work with the widest score spread", () => {
    const movies = [
      makeMovie({ title: "Agreed", userScores: { m1: 7, m2: 7 } }),
      makeMovie({ title: "Split", userScores: { m1: 2, m2: 10 } }),
    ];

    const records = computeClubRecords(movies);

    expect(records.mostDivisive).toMatchObject({ title: "Split", value: 4 });
  });

  it("ignores single-scorer works for the divisive record", () => {
    const movies = [
      makeMovie({ title: "Solo", userScores: { m1: 10 } }),
      makeMovie({ title: "Duo", userScores: { m1: 6, m2: 7 } }),
    ];

    expect(computeClubRecords(movies).mostDivisive).toMatchObject({
      title: "Duo",
    });
  });
});

// ---------- computeMonthlyActivity ----------

describe("computeMonthlyActivity", () => {
  it("returns an empty array for no works", () => {
    expect(computeMonthlyActivity([])).toEqual([]);
  });

  it("counts reviews per month and fills gap months with zero", () => {
    const movies = [
      makeMovie({ createdDate: "2024-01-05T00:00:00.000Z" }),
      makeMovie({ createdDate: "2024-01-20T00:00:00.000Z" }),
      makeMovie({ createdDate: "2024-03-10T00:00:00.000Z" }),
    ];

    const points = computeMonthlyActivity(movies);

    expect(points).toHaveLength(3);
    expect(points.map((p) => p.count)).toEqual([2, 0, 1]);
    expect(points[0].label).toBe("Jan 2024");
    expect(points[1].label).toBe("Feb 2024");
    expect(points[2].label).toBe("Mar 2024");
  });

  it("skips works with invalid dates", () => {
    const movies = [
      makeMovie({ createdDate: "2024-01-05T00:00:00.000Z" }),
      makeMovie({ createdDate: "not-a-date" }),
    ];

    const points = computeMonthlyActivity(movies);

    expect(points).toHaveLength(1);
    expect(points[0].count).toBe(1);
  });
});

// ---------- computeCumulativeCounts ----------

describe("computeCumulativeCounts", () => {
  it("returns a running total in review-date order", () => {
    const movies = [
      makeMovie({ title: "Second", createdDate: "2024-02-01T00:00:00.000Z" }),
      makeMovie({ title: "First", createdDate: "2024-01-01T00:00:00.000Z" }),
      makeMovie({ title: "Third", createdDate: "2024-03-01T00:00:00.000Z" }),
    ];

    const points = computeCumulativeCounts(movies);

    expect(points.map((p) => p.title)).toEqual(["First", "Second", "Third"]);
    expect(points.map((p) => p.total)).toEqual([1, 2, 3]);
  });

  it("skips works with invalid dates", () => {
    const movies = [
      makeMovie({ createdDate: "not-a-date" }),
      makeMovie({ createdDate: "2024-01-01T00:00:00.000Z" }),
    ];

    expect(computeCumulativeCounts(movies)).toHaveLength(1);
  });
});
