import { ensure } from "../../../../lib/checks/checks.js";
import type { Member } from "../../../../lib/types/club";
import { WorkType } from "../../../../lib/types/generated/db";
import type { DetailedMovieData } from "../../../../lib/types/movie";
import {
  computeClubConsensus,
  computeClubCurmudgeons,
  computeDecadeStats,
  computeGenreStats,
  computeGenreWatchCounts,
  computeGuiltyPleasures,
  computeMemberLeaderboard,
  computeScoreTrend,
  computeScoreVariance,
  computeTasteSimilarity,
  computeTmdbDeviation,
  computeTopActors,
  computeTopDirectors,
} from "../statsComputers";
import type { MovieData } from "../types";

function p(name: string): { name: string; profilePath: string | null } {
  return { name, profilePath: null };
}

function makeExternalData(
  overrides: Partial<DetailedMovieData> = {},
): DetailedMovieData {
  return {
    kind: "movie",
    actors: [],
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
    imageUrl: undefined,
    genres: [],
    production_companies: [],
    production_countries: [],
    average: 7,
    userScores: {},
    normalized: {},
    scores: {},
    externalData: makeExternalData(),
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
      [...result.mostLoved, ...result.leastLoved].map((g) => [
        g.genre,
        g.averageScore,
      ]),
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
    const movies = [
      makeMovie({ userScores: { m1: NaN } }),
      makeMovie({ userScores: { m1: 8 } }),
    ];
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
    const members = [
      makeMember({ id: "m1", name: "A" }),
      makeMember({ id: "m2", name: "B" }),
    ];
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
    expect(result[0].movieCount).toBe(2);
    expect(result[0].averageScore).toBe(7);
    expect(result[0].movies).toEqual(["Movie A", "Movie B"]);
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
    expect(x.movieCount).toBe(2);
    expect(x.averageScore).toBe(7);
    expect(y.movieCount).toBe(1);
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

// ---------- computeGenreWatchCounts ----------

describe("computeGenreWatchCounts", () => {
  it("returns empty arrays for empty movie list", () => {
    const result = computeGenreWatchCounts([]);
    expect(result.mostWatched).toEqual([]);
    expect(result.leastWatched).toEqual([]);
  });

  it("counts genre occurrences across movies", () => {
    const movies = [
      makeMovie({ genres: ["Action", "Drama"] }),
      makeMovie({ genres: ["Action"] }),
      makeMovie({ genres: ["Drama", "Comedy"] }),
    ];
    const result = computeGenreWatchCounts(movies);
    const map = Object.fromEntries(
      [...result.mostWatched, ...result.leastWatched].map((g) => [
        g.genre,
        g.count,
      ]),
    );
    expect(map["Action"]).toBe(2);
    expect(map["Drama"]).toBe(2);
    expect(map["Comedy"]).toBe(1);
  });

  it("returns top 5 most watched and bottom 5 least watched", () => {
    const genres = ["A", "B", "C", "D", "E", "F", "G"];
    const movies = genres.flatMap((genre, i) =>
      Array.from({ length: i + 1 }, () => makeMovie({ genres: [genre] })),
    );
    const result = computeGenreWatchCounts(movies);
    expect(result.mostWatched).toHaveLength(5);
    expect(result.leastWatched).toHaveLength(5);
    // Most watched: G (7 count)
    expect(result.mostWatched[0].genre).toBe("G");
    expect(result.mostWatched[0].count).toBe(7);
  });

  it("sorts mostWatched descending and leastWatched ascending", () => {
    const movies = [
      makeMovie({ genres: ["Rare"] }),
      makeMovie({ genres: ["Common"] }),
      makeMovie({ genres: ["Common"] }),
      makeMovie({ genres: ["Common"] }),
    ];
    const result = computeGenreWatchCounts(movies);
    // mostWatched sorted desc
    expect(result.mostWatched[0].count).toBeGreaterThanOrEqual(
      result.mostWatched[result.mostWatched.length - 1].count,
    );
    // leastWatched sorted asc
    expect(result.leastWatched[0].count).toBeLessThanOrEqual(
      result.leastWatched[result.leastWatched.length - 1].count,
    );
  });
});

// ---------- computeClubConsensus ----------

describe("computeClubConsensus", () => {
  it("returns empty arrays when no movies have 2+ scores", () => {
    const members = [makeMember({ id: "m1", name: "Alice" })];
    const movies = [makeMovie({ userScores: { m1: 8 } })];
    const result = computeClubConsensus(movies, members);
    expect(result.mostAgreed).toEqual([]);
    expect(result.mostDivisive).toEqual([]);
  });

  it("returns empty arrays for empty movie list", () => {
    const result = computeClubConsensus([], [makeMember()]);
    expect(result.mostAgreed).toEqual([]);
    expect(result.mostDivisive).toEqual([]);
  });

  it("calculates stdDev 0 for perfect agreement", () => {
    const members = [
      makeMember({ id: "m1", name: "Alice" }),
      makeMember({ id: "m2", name: "Bob" }),
    ];
    const movies = [
      makeMovie({ title: "Perfect", userScores: { m1: 8, m2: 8 } }),
      makeMovie({ title: "Also Perfect", userScores: { m1: 6, m2: 6 } }),
      makeMovie({ title: "Third", userScores: { m1: 7, m2: 7 } }),
    ];
    const result = computeClubConsensus(movies, members);
    expect(result.mostAgreed[0].stdDev).toBe(0);
  });

  it("identifies most agreed and most divisive movies", () => {
    const members = [
      makeMember({ id: "m1", name: "Alice" }),
      makeMember({ id: "m2", name: "Bob" }),
    ];
    // Agreed: 7 vs 7, stdDev = 0. Divisive: 1 vs 9, stdDev = 4.
    const movies = [
      makeMovie({ title: "Agree", userScores: { m1: 7, m2: 7 } }),
      makeMovie({ title: "Divisive", userScores: { m1: 1, m2: 9 } }),
      makeMovie({ title: "Mid", userScores: { m1: 5, m2: 7 } }),
    ];
    const result = computeClubConsensus(movies, members);
    expect(result.mostAgreed[0].title).toBe("Agree");
    expect(result.mostDivisive[0].title).toBe("Divisive");
    expect(result.mostDivisive[0].stdDev).toBe(4);
  });

  it("scores are sorted descending within entry", () => {
    const members = [
      makeMember({ id: "m1", name: "Alice" }),
      makeMember({ id: "m2", name: "Bob" }),
    ];
    const movies = [
      makeMovie({ title: "Film", userScores: { m1: 3, m2: 9 } }),
      makeMovie({ title: "Film2", userScores: { m1: 4, m2: 8 } }),
      makeMovie({ title: "Film3", userScores: { m1: 5, m2: 7 } }),
    ];
    const result = computeClubConsensus(movies, members);
    const scores = result.mostDivisive[0].scores;
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i - 1].score).toBeGreaterThanOrEqual(scores[i].score);
    }
  });

  it("includes member name in scores using memberMap", () => {
    const members = [
      makeMember({ id: "m1", name: "Alice" }),
      makeMember({ id: "m2", name: "Bob" }),
    ];
    const movies = [makeMovie({ userScores: { m1: 7, m2: 5 } })];
    const result = computeClubConsensus(movies, members);
    const entry = ensure(result.mostAgreed[0] ?? result.mostDivisive[0]);
    const names = entry.scores.map((s) => s.name);
    expect(names).toContain("Alice");
    expect(names).toContain("Bob");
  });

  it("skips NaN and undefined scores", () => {
    const members = [
      makeMember({ id: "m1", name: "Alice" }),
      makeMember({ id: "m2", name: "Bob" }),
      makeMember({ id: "m3", name: "Carol" }),
    ];
    const movies = [
      makeMovie({ userScores: { m1: 7, m2: NaN, m3: 5 } }),
      makeMovie({ userScores: { m1: 6, m2: undefined, m3: 4 } }),
      makeMovie({ userScores: { m1: 8, m2: 8, m3: 8 } }),
    ];
    const result = computeClubConsensus(movies, members);
    // Only 2 valid scores for first 2 movies — they should still qualify
    expect(
      result.mostAgreed.length + result.mostDivisive.length,
    ).toBeGreaterThan(0);
  });
});

// ---------- computeClubCurmudgeons ----------

describe("computeClubCurmudgeons", () => {
  it("returns empty array for empty movie list", () => {
    expect(computeClubCurmudgeons([], [makeMember()])).toEqual([]);
  });

  it("returns empty when no score is 2+ below average", () => {
    const members = [
      makeMember({ id: "m1", name: "Alice" }),
      makeMember({ id: "m2", name: "Bob" }),
    ];
    const movies = [
      makeMovie({ average: 7, userScores: { m1: 6.5, m2: 7.5 } }),
    ];
    expect(computeClubCurmudgeons(movies, members)).toEqual([]);
  });

  it("identifies a curmudgeon when exactly one member scores 2+ below average", () => {
    const members = [
      makeMember({ id: "m1", name: "Alice" }),
      makeMember({ id: "m2", name: "Bob" }),
    ];
    const movies = [
      makeMovie({
        title: "Low Movie",
        average: 7,
        userScores: { m1: 4, m2: 10 },
      }),
    ];
    const result = computeClubCurmudgeons(movies, members);
    expect(result).toHaveLength(1);
    expect(result[0].member.name).toBe("Alice");
    expect(result[0].movies[0].title).toBe("Low Movie");
    expect(result[0].movies[0].memberScore).toBe(4);
    expect(result[0].movies[0].clubAverage).toBe(7);
  });

  it("excludes movie when two members are both 2+ below average", () => {
    const members = [
      makeMember({ id: "m1", name: "Alice" }),
      makeMember({ id: "m2", name: "Bob" }),
      makeMember({ id: "m3", name: "Carol" }),
    ];
    const movies = [
      makeMovie({
        title: "Both Low",
        average: 8,
        userScores: { m1: 5, m2: 5, m3: 10 },
      }),
    ];
    expect(computeClubCurmudgeons(movies, members)).toEqual([]);
  });

  it("skips movies with fewer than 2 valid scores", () => {
    const members = [makeMember({ id: "m1" }), makeMember({ id: "m2" })];
    const movies = [makeMovie({ average: 8, userScores: { m1: 4 } })];
    expect(computeClubCurmudgeons(movies, members)).toEqual([]);
  });

  it("limits each member to top 5 movies by lowest difference", () => {
    const members = [
      makeMember({ id: "m1", name: "Alice" }),
      makeMember({ id: "m2", name: "Bob" }),
    ];
    const movies = Array.from({ length: 7 }, (_, i) =>
      makeMovie({
        id: `movie-${i}`,
        title: `Movie ${i}`,
        average: 9,
        userScores: { m1: 6 - i * 0.1, m2: 10 },
      }),
    );
    const result = computeClubCurmudgeons(movies, members);
    expect(result).toHaveLength(1);
    expect(result[0].movies).toHaveLength(5);
  });

  it("sorts members by number of curmudgeon movies descending", () => {
    const members = [
      makeMember({ id: "m1", name: "Alice" }),
      makeMember({ id: "m2", name: "Bob" }),
    ];
    const movies = [
      makeMovie({
        title: "A1",
        average: 8,
        userScores: { m1: 10, m2: 5 },
      }),
      makeMovie({
        title: "A2",
        average: 8,
        userScores: { m1: 10, m2: 4 },
      }),
      makeMovie({
        title: "B1",
        average: 8,
        userScores: { m1: 5, m2: 10 },
      }),
    ];
    const result = computeClubCurmudgeons(movies, members);
    expect(result[0].member.name).toBe("Bob");
    expect(result[0].movies).toHaveLength(2);
  });
});

// ---------- computeTmdbDeviation ----------

describe("computeTmdbDeviation", () => {
  it("returns empty arrays for empty movie list", () => {
    const result = computeTmdbDeviation([]);
    expect(result.clubRatedHigher).toEqual([]);
    expect(result.clubRatedLower).toEqual([]);
  });

  it("excludes movies with no TMDB score or score of 0", () => {
    const movies = [
      makeMovie({
        average: 8,
        externalData: makeExternalData({ vote_average: 0 }),
      }),
      makeMovie({
        average: 8,
        externalData: makeExternalData({ vote_average: undefined }),
      }),
    ];
    const result = computeTmdbDeviation(movies);
    expect(result.clubRatedHigher).toEqual([]);
    expect(result.clubRatedLower).toEqual([]);
  });

  it("returns movies where club rated higher (positive deviation)", () => {
    const movies = [
      makeMovie({
        title: "Underrated",
        average: 9,
        externalData: makeExternalData({ vote_average: 5 }),
      }),
    ];
    const result = computeTmdbDeviation(movies);
    expect(result.clubRatedHigher).toHaveLength(1);
    expect(result.clubRatedHigher[0].title).toBe("Underrated");
    expect(result.clubRatedHigher[0].deviation).toBe(4);
    expect(result.clubRatedLower).toEqual([]);
  });

  it("returns movies where club rated lower (negative deviation)", () => {
    const movies = [
      makeMovie({
        title: "Overrated",
        average: 4,
        externalData: makeExternalData({ vote_average: 8 }),
      }),
    ];
    const result = computeTmdbDeviation(movies);
    expect(result.clubRatedLower).toHaveLength(1);
    expect(result.clubRatedLower[0].title).toBe("Overrated");
    expect(result.clubRatedLower[0].deviation).toBe(-4);
    expect(result.clubRatedHigher).toEqual([]);
  });

  it("excludes movies with exactly 0 deviation from both lists", () => {
    const movies = [
      makeMovie({
        title: "Exact Match",
        average: 7,
        externalData: makeExternalData({ vote_average: 7 }),
      }),
    ];
    const result = computeTmdbDeviation(movies);
    // deviation=0 is neither >0 nor <0 so excluded from both
    expect(result.clubRatedHigher).toEqual([]);
    expect(result.clubRatedLower).toEqual([]);
  });

  it("returns max 5 entries per side", () => {
    const movies = Array.from({ length: 8 }, (_, i) =>
      makeMovie({
        id: String(i),
        title: `High ${i}`,
        average: 9,
        externalData: makeExternalData({ vote_average: i + 1 }),
      }),
    );
    const result = computeTmdbDeviation(movies);
    expect(result.clubRatedHigher.length).toBeLessThanOrEqual(5);
  });

  it("sorts clubRatedHigher by deviation descending and clubRatedLower ascending", () => {
    const movies = [
      makeMovie({
        title: "A",
        average: 9,
        externalData: makeExternalData({ vote_average: 5 }),
      }),
      makeMovie({
        title: "B",
        average: 10,
        externalData: makeExternalData({ vote_average: 4 }),
      }),
      makeMovie({
        title: "C",
        average: 4,
        externalData: makeExternalData({ vote_average: 8 }),
      }),
      makeMovie({
        title: "D",
        average: 2,
        externalData: makeExternalData({ vote_average: 9 }),
      }),
    ];
    const result = computeTmdbDeviation(movies);
    // clubRatedHigher: B (dev=6) then A (dev=4)
    expect(result.clubRatedHigher[0].title).toBe("B");
    // clubRatedLower: D (dev=-7) then C (dev=-4)
    expect(result.clubRatedLower[0].title).toBe("D");
  });
});

// ---------- computeDecadeStats ----------

describe("computeDecadeStats", () => {
  it("returns empty array for empty movie list", () => {
    expect(computeDecadeStats([])).toEqual([]);
  });

  it("skips movies without a valid release date", () => {
    const movies = [
      makeMovie({ externalData: makeExternalData({ release_date: "" }) }),
      makeMovie({
        externalData: makeExternalData({ release_date: "bad-date" }),
      }),
    ];
    expect(computeDecadeStats(movies)).toEqual([]);
  });

  it("groups movies into correct decade buckets", () => {
    const movies = [
      makeMovie({
        average: 8,
        externalData: makeExternalData({ release_date: "1985-06-01" }),
      }),
      makeMovie({
        average: 6,
        externalData: makeExternalData({ release_date: "1987-03-15" }),
      }),
      makeMovie({
        average: 9,
        externalData: makeExternalData({ release_date: "1999-12-01" }),
      }),
    ];
    const result = computeDecadeStats(movies);
    const eighties = ensure(result.find((d) => d.decade === "1980s"));
    const nineties = ensure(result.find((d) => d.decade === "1990s"));
    expect(eighties.count).toBe(2);
    expect(eighties.averageScore).toBe(7);
    expect(nineties.count).toBe(1);
    expect(nineties.averageScore).toBe(9);
  });

  it("uses member-specific scores when memberId is provided", () => {
    const movies = [
      makeMovie({
        average: 5,
        userScores: { m1: 9 },
        externalData: makeExternalData({ release_date: "2000-01-01" }),
      }),
      makeMovie({
        average: 5,
        userScores: { m1: 7 },
        externalData: makeExternalData({ release_date: "2005-01-01" }),
      }),
    ];
    const withMember = computeDecadeStats(movies, "m1");
    const twoThousands = ensure(withMember.find((d) => d.decade === "2000s"));
    expect(twoThousands.averageScore).toBe(8);

    const withAverage = computeDecadeStats(movies);
    const twoThousandsAvg = ensure(
      withAverage.find((d) => d.decade === "2000s"),
    );
    expect(twoThousandsAvg.averageScore).toBe(5);
  });

  it("sorts results by decade alphabetically/chronologically", () => {
    const movies = [
      makeMovie({
        average: 7,
        externalData: makeExternalData({ release_date: "2010-01-01" }),
      }),
      makeMovie({
        average: 7,
        externalData: makeExternalData({ release_date: "1990-01-01" }),
      }),
      makeMovie({
        average: 7,
        externalData: makeExternalData({ release_date: "2000-01-01" }),
      }),
    ];
    const result = computeDecadeStats(movies);
    expect(result.map((d) => d.decade)).toEqual(["1990s", "2000s", "2010s"]);
  });

  it("skips movies with undefined member score when memberId is provided", () => {
    const movies = [
      makeMovie({
        userScores: { m1: 8 },
        externalData: makeExternalData({ release_date: "2000-01-01" }),
      }),
      makeMovie({
        userScores: {},
        externalData: makeExternalData({ release_date: "2001-01-01" }),
      }),
    ];
    const result = computeDecadeStats(movies, "m1");
    const twoThousands = ensure(result.find((d) => d.decade === "2000s"));
    expect(twoThousands.count).toBe(1);
  });
});

// ---------- computeScoreTrend ----------

describe("computeScoreTrend", () => {
  function makeReviewedMovieWithScore(
    memberId: string,
    score: number,
    date: string,
    title = `Movie ${score}`,
  ): MovieData {
    return makeMovie({
      id: `${memberId}-${date}`,
      title,
      scores: {
        [memberId]: { id: "x", created_date: date, score },
      },
      userScores: { [memberId]: score },
    });
  }

  it("returns empty map for empty movie list", () => {
    const members = [makeMember({ id: "m1" })];
    const result = computeScoreTrend([], members);
    expect(result.size).toBe(0);
  });

  it("returns empty map for empty members list", () => {
    const movies = [makeReviewedMovieWithScore("m1", 7, "2024-01-01")];
    const result = computeScoreTrend(movies, []);
    expect(result.size).toBe(0);
  });

  it("omits members with no reviews", () => {
    const members = [makeMember({ id: "m1" }), makeMember({ id: "m2" })];
    const movies = Array.from({ length: 5 }, (_, i) =>
      makeReviewedMovieWithScore("m1", 7, `2024-01-0${i + 1}`),
    );
    const result = computeScoreTrend(movies, members);
    expect(result.has("m1")).toBe(true);
    expect(result.has("m2")).toBe(false);
  });

  it("sorts trend points chronologically", () => {
    const members = [makeMember({ id: "m1" })];
    const movies = [
      makeReviewedMovieWithScore("m1", 6, "2024-01-05"),
      makeReviewedMovieWithScore("m1", 8, "2024-01-01"),
      makeReviewedMovieWithScore("m1", 7, "2024-01-03"),
      makeReviewedMovieWithScore("m1", 5, "2024-01-02"),
      makeReviewedMovieWithScore("m1", 9, "2024-01-04"),
    ];
    const result = computeScoreTrend(movies, members);
    const points = ensure(result.get("m1"));
    for (let i = 1; i < points.length; i++) {
      expect(points[i].date.getTime()).toBeGreaterThanOrEqual(
        points[i - 1].date.getTime(),
      );
    }
  });

  it("computes rolling average over a window", () => {
    const members = [makeMember({ id: "m1" })];
    // Provide enough reviews to exceed the min window of 5
    const scores = [8, 8, 8, 8, 8, 6, 6, 6, 6, 6];
    const movies = scores.map((score, i) =>
      makeReviewedMovieWithScore(
        "m1",
        score,
        `2024-01-${String(i + 1).padStart(2, "0")}`,
      ),
    );
    const result = computeScoreTrend(movies, members);
    const points = ensure(result.get("m1"));
    expect(points.length).toBeGreaterThan(0);
    // First rolling avg should be dominated by 8s; last by 6s
    const firstAvg = points[0].rollingAverage;
    const lastAvg = points[points.length - 1].rollingAverage;
    expect(firstAvg).toBeGreaterThan(lastAvg);
  });

  it("skips reviews with missing or invalid created_date", () => {
    const members = [makeMember({ id: "m1" })];
    const movies: MovieData[] = [
      ...Array.from({ length: 5 }, (_, i) =>
        makeReviewedMovieWithScore("m1", 7, `2024-01-0${i + 1}`),
      ),
      makeMovie({
        id: "bad1",
        scores: { m1: { id: "x", created_date: "", score: 5 } },
      }),
      makeMovie({
        id: "bad2",
        scores: { m1: { id: "y", created_date: "not-a-date", score: 5 } },
      }),
    ];
    const result = computeScoreTrend(movies, members);
    const points = ensure(result.get("m1"));
    // Only 5 valid reviews, window=5, so exactly 1 trend point
    expect(points).toHaveLength(1);
  });

  it("includes actualScore and movieTitle in each point", () => {
    const members = [makeMember({ id: "m1" })];
    const movies = Array.from({ length: 5 }, (_, i) =>
      makeReviewedMovieWithScore("m1", i + 6, `2024-01-0${i + 1}`, `Film ${i}`),
    );
    const result = computeScoreTrend(movies, members);
    const points = ensure(result.get("m1"));
    expect(points[0].actualScore).toBeDefined();
    expect(points[0].movieTitle).toMatch(/Film/);
  });
});

// ---------- computeTopActors ----------

describe("computeTopActors", () => {
  it("returns empty for empty movie list", () => {
    expect(computeTopActors([])).toEqual([]);
  });

  it("skips movies with no actors", () => {
    const movies = [
      makeMovie({
        average: 8,
        externalData: makeExternalData({ actors: [] }),
      }),
    ];
    expect(computeTopActors(movies)).toEqual([]);
  });

  it("accumulates movies per actor correctly", () => {
    const movies = [
      makeMovie({
        title: "Movie A",
        average: 8,
        externalData: makeExternalData({ actors: [p("Streep")] }),
      }),
      makeMovie({
        title: "Movie B",
        average: 6,
        externalData: makeExternalData({ actors: [p("Streep")] }),
      }),
    ];
    const result = computeTopActors(movies);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Streep");
    expect(result[0].movieCount).toBe(2);
    expect(result[0].averageScore).toBe(7);
  });

  it("returns max 5 actors", () => {
    const actors = ["A", "B", "C", "D", "E", "F", "G"];
    const movies = actors.flatMap((actor) => [
      makeMovie({
        average: 7,
        externalData: makeExternalData({ actors: [p(actor)] }),
      }),
      makeMovie({
        average: 7,
        externalData: makeExternalData({ actors: [p(actor)] }),
      }),
    ]);
    expect(computeTopActors(movies)).toHaveLength(5);
  });

  it("sorts by movie count first, then by average score", () => {
    const movies = [
      // Actor A: 3 movies, avg 5
      makeMovie({
        average: 5,
        externalData: makeExternalData({ actors: [p("A")] }),
      }),
      makeMovie({
        average: 5,
        externalData: makeExternalData({ actors: [p("A")] }),
      }),
      makeMovie({
        average: 5,
        externalData: makeExternalData({ actors: [p("A")] }),
      }),
      // Actor B: 2 movies, avg 9
      makeMovie({
        average: 9,
        externalData: makeExternalData({ actors: [p("B")] }),
      }),
      makeMovie({
        average: 9,
        externalData: makeExternalData({ actors: [p("B")] }),
      }),
    ];
    const result = computeTopActors(movies);
    expect(result[0].name).toBe("A");
    expect(result[1].name).toBe("B");
  });

  it("handles movies with multiple actors", () => {
    const movies = [
      makeMovie({
        title: "Collab",
        average: 8,
        externalData: makeExternalData({ actors: [p("Tom"), p("Jane")] }),
      }),
      makeMovie({
        title: "Solo Tom",
        average: 6,
        externalData: makeExternalData({ actors: [p("Tom")] }),
      }),
    ];
    const result = computeTopActors(movies);
    const tom = ensure(result.find((a) => a.name === "Tom"));
    const jane = ensure(result.find((a) => a.name === "Jane"));
    expect(tom.movieCount).toBe(2);
    expect(tom.averageScore).toBe(7);
    expect(jane.movieCount).toBe(1);
    expect(jane.averageScore).toBe(8);
  });

  it("uses profile path for image URL when available", () => {
    const movies = [
      makeMovie({
        average: 7,
        externalData: makeExternalData({
          actors: [{ name: "Hanks", profilePath: "/hanks.jpg" }],
        }),
      }),
    ];
    const result = computeTopActors(movies);
    expect(result[0].profileImageUrl).toContain("/hanks.jpg");
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
      ...Array.from({ length: 5 }, (_, i) =>
        makeReviewedMovie(i + 1, { m1: 8, m2: 2 }),
      ),
      ...Array.from({ length: 5 }, (_, i) =>
        makeReviewedMovie(i + 6, { m1: 7, m2: 7 }),
      ),
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
    const movies = Array.from({ length: 5 }, (_, i) =>
      makeReviewedMovie(i + 1, { m1: 8, m2: 2 }),
    );
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
      expect(points[i].date.getTime()).toBeGreaterThanOrEqual(
        points[i - 1].date.getTime(),
      );
    }
  });
});
