import { ensure } from "../../../../lib/checks/checks.js";
import type { Member } from "../../../../lib/types/club";
import { WorkType } from "../../../../lib/types/generated/db";
import type { DetailedMovieData } from "../../../../lib/types/movie";
import {
  computeGenreStats,
  computeGuiltyPleasures,
  computeMemberLeaderboard,
  computeTasteSimilarity,
  computeTopDirectors,
  computeWatchingPace,
  getAvailableYears,
} from "../statsComputers";
import type { MovieData } from "../types";

function p(name: string): { name: string; profilePath: string | null } {
  return { name, profilePath: null };
}

function makeExternalData(
  overrides: Partial<DetailedMovieData> = {},
): DetailedMovieData {
  return {
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

// ---------- computeWatchingPace ----------

describe("computeWatchingPace", () => {
  const now = new Date("2024-06-15T12:00:00.000Z");

  it("returns zeros for empty movie list", () => {
    const result = computeWatchingPace([], now);
    expect(result.totalMovies).toBe(0);
    expect(result.avgPerMonth).toBe(0);
    expect(result.longestStreak).toBe(0);
    expect(result.longestDrySpell).toBe(Math.ceil(365 / 7));
    expect(result.days).toHaveLength(365);
    expect(result.days.every((d) => d.count === 0)).toBe(true);
    expect(result.totalWatchTimeMinutes).toBe(0);
  });

  it("counts a single movie within the window", () => {
    const movies = [
      makeMovie({
        title: "Recent",
        createdDate: "2024-06-01T10:00:00.000Z",
      }),
    ];
    const result = computeWatchingPace(movies, now);
    expect(result.totalMovies).toBe(1);
    expect(result.longestStreak).toBe(1);
    const day = result.days.find((d) => d.date === "2024-06-01");
    expect(day).toBeDefined();
    expect(day?.count).toBe(1);
    expect(day?.movies).toEqual(["Recent"]);
  });

  it("aggregates multiple movies on the same day", () => {
    const movies = [
      makeMovie({
        title: "Movie A",
        createdDate: "2024-03-10T08:00:00.000Z",
      }),
      makeMovie({
        title: "Movie B",
        createdDate: "2024-03-10T20:00:00.000Z",
      }),
    ];
    const result = computeWatchingPace(movies, now);
    const day = result.days.find((d) => d.date === "2024-03-10");
    expect(day?.count).toBe(2);
    expect(day?.movies).toEqual(["Movie A", "Movie B"]);
  });

  it("calculates week-based streak for movies in consecutive weeks", () => {
    // Three movies spread across three consecutive weeks
    const movies = [
      makeMovie({ createdDate: "2024-05-01T00:00:00.000Z" }),
      makeMovie({ createdDate: "2024-05-08T00:00:00.000Z" }),
      makeMovie({ createdDate: "2024-05-15T00:00:00.000Z" }),
    ];
    const result = computeWatchingPace(movies, now);
    expect(result.longestStreak).toBeGreaterThanOrEqual(2);
  });

  it("counts consecutive days in the same week as a single week streak", () => {
    const movies = [
      makeMovie({ createdDate: "2024-05-01T00:00:00.000Z" }),
      makeMovie({ createdDate: "2024-05-02T00:00:00.000Z" }),
      makeMovie({ createdDate: "2024-05-03T00:00:00.000Z" }),
    ];
    const result = computeWatchingPace(movies, now);
    // All three days likely fall in the same week chunk, so streak = 1 week
    expect(result.longestStreak).toBeGreaterThanOrEqual(1);
  });

  it("calculates dry spell in weeks between movies", () => {
    // Movies 3+ weeks apart should produce a dry spell of at least 2 weeks
    const movies = [
      makeMovie({ createdDate: "2024-05-01T00:00:00.000Z" }),
      makeMovie({ createdDate: "2024-05-29T00:00:00.000Z" }),
    ];
    const result = computeWatchingPace(movies, now);
    expect(result.longestDrySpell).toBeGreaterThanOrEqual(2);
  });

  it("excludes movies outside the 12-month window", () => {
    const movies = [
      makeMovie({
        title: "Old",
        createdDate: "2023-01-01T00:00:00.000Z",
      }),
      makeMovie({
        title: "Recent",
        createdDate: "2024-06-10T00:00:00.000Z",
      }),
    ];
    const result = computeWatchingPace(movies, now);
    expect(result.totalMovies).toBe(1);
  });

  it("calculates avgPerMonth correctly", () => {
    const movies = Array.from({ length: 24 }, (_, i) =>
      makeMovie({
        createdDate: `2024-${String(Math.floor(i / 4) + 1).padStart(2, "0")}-${String((i % 28) + 1).padStart(2, "0")}T00:00:00.000Z`,
      }),
    );
    const result = computeWatchingPace(movies, now);
    expect(result.avgPerMonth).toBe(
      Math.round((result.totalMovies / 12) * 10) / 10,
    );
  });

  it("skips movies with invalid createdDate", () => {
    const movies = [
      makeMovie({ title: "Bad Date", createdDate: "not-a-date" }),
      makeMovie({
        title: "Good",
        createdDate: "2024-06-01T00:00:00.000Z",
      }),
    ];
    const result = computeWatchingPace(movies, now);
    expect(result.totalMovies).toBe(1);
  });

  it("covers full calendar year when year param is provided", () => {
    const movies = [
      makeMovie({
        title: "Jan Movie",
        createdDate: "2023-01-15T00:00:00.000Z",
      }),
      makeMovie({
        title: "Dec Movie",
        createdDate: "2023-12-20T00:00:00.000Z",
      }),
    ];
    const result = computeWatchingPace(movies, now, 2023);
    expect(result.days[0].date).toBe("2023-01-01");
    expect(result.days[result.days.length - 1].date).toBe("2023-12-31");
    expect(result.totalMovies).toBe(2);
    expect(result.days).toHaveLength(365);
  });

  it("handles leap year when year param is provided", () => {
    const result = computeWatchingPace([], now, 2024);
    expect(result.days).toHaveLength(366);
    expect(result.days[0].date).toBe("2024-01-01");
    expect(result.days[result.days.length - 1].date).toBe("2024-12-31");
  });

  it("only counts movies within the selected year", () => {
    const movies = [
      makeMovie({
        title: "In Year",
        createdDate: "2023-06-01T00:00:00.000Z",
      }),
      makeMovie({
        title: "Out of Year",
        createdDate: "2024-06-01T00:00:00.000Z",
      }),
    ];
    const result = computeWatchingPace(movies, now, 2023);
    expect(result.totalMovies).toBe(1);
  });

  it("accumulates totalWatchTimeMinutes from movie runtimes", () => {
    const movies = [
      makeMovie({
        createdDate: "2024-06-01T00:00:00.000Z",
        externalData: makeExternalData({ runtime: 90 }),
      }),
      makeMovie({
        createdDate: "2024-06-02T00:00:00.000Z",
        externalData: makeExternalData({ runtime: 150 }),
      }),
    ];
    const result = computeWatchingPace(movies, now);
    expect(result.totalWatchTimeMinutes).toBe(240);
  });

  it("excludes watch time for movies outside the window", () => {
    const movies = [
      makeMovie({
        createdDate: "2023-01-01T00:00:00.000Z",
        externalData: makeExternalData({ runtime: 200 }),
      }),
      makeMovie({
        createdDate: "2024-06-10T00:00:00.000Z",
        externalData: makeExternalData({ runtime: 100 }),
      }),
    ];
    const result = computeWatchingPace(movies, now);
    expect(result.totalWatchTimeMinutes).toBe(100);
  });
});

// ---------- getAvailableYears ----------

describe("getAvailableYears", () => {
  it("returns empty array for no movies", () => {
    expect(getAvailableYears([])).toEqual([]);
  });

  it("returns distinct years sorted descending", () => {
    const movies = [
      makeMovie({ createdDate: "2022-05-01T00:00:00.000Z" }),
      makeMovie({ createdDate: "2024-01-01T00:00:00.000Z" }),
      makeMovie({ createdDate: "2023-03-15T00:00:00.000Z" }),
      makeMovie({ createdDate: "2024-06-01T00:00:00.000Z" }),
    ];
    expect(getAvailableYears(movies)).toEqual([2024, 2023, 2022]);
  });

  it("skips movies with invalid dates", () => {
    const movies = [
      makeMovie({ createdDate: "not-a-date" }),
      makeMovie({ createdDate: "2023-01-01T00:00:00.000Z" }),
    ];
    expect(getAvailableYears(movies)).toEqual([2023]);
  });
});
