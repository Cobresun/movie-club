import { ensure } from "../../../../lib/checks/checks.js";
import type { Member } from "../../../../lib/types/club";
import { WorkType } from "../../../../lib/types/generated/db";
import type { DetailedMovieData } from "../../../../lib/types/movie";
import {
  computeGenreStats,
  computeMemberLeaderboard,
  computeTasteSimilarity,
  computeTopDirectors,
} from "../statsComputers";
import type { MovieData } from "../types";

function makeExternalData(
  overrides: Partial<DetailedMovieData> = {},
): DetailedMovieData {
  return {
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

  it("skips movies with score 0", () => {
    const movies = [
      makeMovie({ genres: ["Horror"], average: 0 }),
      makeMovie({ genres: ["Horror"], average: 8 }),
      makeMovie({ genres: ["Horror"], average: 6 }),
    ];
    const result = computeGenreStats(movies);
    expect(result.mostLoved[0].averageScore).toBe(7);
    expect(result.mostLoved[0].count).toBe(2);
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

  it("skips movies with average 0", () => {
    const movies = [
      makeMovie({
        average: 0,
        externalData: makeExternalData({ directors: ["Spielberg"] }),
      }),
    ];
    expect(computeTopDirectors(movies)).toEqual([]);
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
        externalData: makeExternalData({ directors: ["Nolan"] }),
      }),
      makeMovie({
        title: "Movie B",
        average: 6,
        externalData: makeExternalData({ directors: ["Nolan"] }),
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
        externalData: makeExternalData({ directors: [dir] }),
      }),
      makeMovie({
        average: 7,
        externalData: makeExternalData({ directors: [dir] }),
      }),
    ]);
    expect(computeTopDirectors(movies)).toHaveLength(5);
  });

  it("sorts by movie count first, then by average score", () => {
    const movies = [
      // Director A: 3 movies, avg 5
      makeMovie({
        average: 5,
        externalData: makeExternalData({ directors: ["A"] }),
      }),
      makeMovie({
        average: 5,
        externalData: makeExternalData({ directors: ["A"] }),
      }),
      makeMovie({
        average: 5,
        externalData: makeExternalData({ directors: ["A"] }),
      }),
      // Director B: 2 movies, avg 9
      makeMovie({
        average: 9,
        externalData: makeExternalData({ directors: ["B"] }),
      }),
      makeMovie({
        average: 9,
        externalData: makeExternalData({ directors: ["B"] }),
      }),
      // Director C: 2 movies, avg 7
      makeMovie({
        average: 7,
        externalData: makeExternalData({ directors: ["C"] }),
      }),
      makeMovie({
        average: 7,
        externalData: makeExternalData({ directors: ["C"] }),
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
        externalData: makeExternalData({ directors: ["X", "Y"] }),
      }),
      makeMovie({
        title: "Solo X",
        average: 6,
        externalData: makeExternalData({ directors: ["X"] }),
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
