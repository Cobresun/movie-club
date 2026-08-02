import { describe, expect, it } from "vitest";

import { toMovieDataSummary } from "../movieProvider";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/**
 * The aggregate `movie_details` row shape `toMovieDataSummary` consumes. We
 * derive it from the function's own parameter type so the fixture stays honest
 * without `as` casts — if the query's select list changes, this stops compiling.
 */
type MovieRowLike = Parameters<typeof toMovieDataSummary>[0];

function makeMovieRow(overrides: Partial<MovieRowLike> = {}): MovieRowLike {
  return {
    external_id: "27205",
    tmdb_score: "8.36",
    runtime: "148",
    budget: "160000000",
    revenue: "836836967",
    release_date: new Date("2010-07-16"),
    adult: false,
    backdrop_path: "/s3TBrRGB1iav7gFOCNx3H31MoES.jpg",
    homepage: "https://www.warnerbros.com/movies/inception",
    imdb_id: "tt1375666",
    original_language: "en",
    original_title: "Inception",
    overview: "Cobb steals information from his targets by entering their dreams.",
    popularity: "87.3",
    poster_path: "/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg",
    status: "Released",
    tagline: "Your mind is the scene of the crime.",
    genres: ["Action", "Science Fiction", "Adventure"],
    production_companies: ["Warner Bros.", "Legendary Entertainment"],
    production_countries: ["United States of America", "United Kingdom"],
    directors: [{ name: "Christopher Nolan", profilePath: null }],
    cast_names: ["Leonardo DiCaprio", "Joseph Gordon-Levitt"],
    major_cast_names: ["Leonardo DiCaprio", "Joseph Gordon-Levitt"],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// toMovieDataSummary — discriminant & scalar mapping
// ---------------------------------------------------------------------------

describe("toMovieDataSummary — field mapping", () => {
  it("tags the result with the movie discriminant", () => {
    expect(toMovieDataSummary(makeMovieRow()).kind).toBe("movie");
  });

  it("maps overview directly", () => {
    const row = makeMovieRow({ overview: "A heist inside dreams." });
    expect(toMovieDataSummary(row).overview).toBe("A heist inside dreams.");
  });

  it("coerces the tmdb_score string to a number for vote_average", () => {
    const row = makeMovieRow({ tmdb_score: "8.36" });
    expect(toMovieDataSummary(row).vote_average).toBe(8.36);
  });

  it("sets vote_average to undefined when tmdb_score is null", () => {
    const row = makeMovieRow({ tmdb_score: null });
    expect(toMovieDataSummary(row).vote_average).toBeUndefined();
  });

  it("converts the release_date Date to an ISO string", () => {
    const date = new Date("2010-07-16");
    const row = makeMovieRow({ release_date: date });
    expect(toMovieDataSummary(row).release_date).toBe(date.toISOString());
  });

  it("sets release_date to undefined when it is null", () => {
    const row = makeMovieRow({ release_date: null });
    expect(toMovieDataSummary(row).release_date).toBeUndefined();
  });

  it("coerces nullable numeric columns to numbers", () => {
    const row = makeMovieRow({
      budget: "160000000",
      revenue: "836836967",
      runtime: "148",
      popularity: "87.3",
    });
    const result = toMovieDataSummary(row);
    expect(result.budget).toBe(160000000);
    expect(result.revenue).toBe(836836967);
    expect(result.runtime).toBe(148);
    expect(result.popularity).toBe(87.3);
  });

  it("sets numeric columns to undefined when null", () => {
    const row = makeMovieRow({
      budget: null,
      revenue: null,
      runtime: null,
      popularity: null,
    });
    const result = toMovieDataSummary(row);
    expect(result.budget).toBeUndefined();
    expect(result.revenue).toBeUndefined();
    expect(result.runtime).toBeUndefined();
    expect(result.popularity).toBeUndefined();
  });

  it("passes through scalar string and boolean fields", () => {
    const row = makeMovieRow({
      adult: true,
      backdrop_path: "/backdrop.jpg",
      homepage: "https://example.com",
      imdb_id: "tt1375666",
      original_language: "en",
      original_title: "Inception",
      poster_path: "/poster.jpg",
      status: "Released",
      tagline: "Your mind is the scene of the crime.",
    });
    const result = toMovieDataSummary(row);
    expect(result.adult).toBe(true);
    expect(result.backdrop_path).toBe("/backdrop.jpg");
    expect(result.homepage).toBe("https://example.com");
    expect(result.imdb_id).toBe("tt1375666");
    expect(result.original_language).toBe("en");
    expect(result.original_title).toBe("Inception");
    expect(result.poster_path).toBe("/poster.jpg");
    expect(result.status).toBe("Released");
    expect(result.tagline).toBe("Your mind is the scene of the crime.");
  });

  it("coerces nullable string columns to undefined", () => {
    const row = makeMovieRow({
      adult: null,
      backdrop_path: null,
      homepage: null,
      imdb_id: null,
      original_language: null,
      original_title: null,
      poster_path: null,
      status: null,
      tagline: null,
    });
    const result = toMovieDataSummary(row);
    expect(result.adult).toBeUndefined();
    expect(result.backdrop_path).toBeUndefined();
    expect(result.homepage).toBeUndefined();
    expect(result.poster_path).toBeUndefined();
    expect(result.tagline).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// toMovieDataSummary — array handling
// ---------------------------------------------------------------------------

describe("toMovieDataSummary — array handling", () => {
  it("includes genres when present", () => {
    const row = makeMovieRow({ genres: ["Drama", "Thriller"] });
    expect(toMovieDataSummary(row).genres).toEqual(["Drama", "Thriller"]);
  });

  it("returns an empty array for genres when null", () => {
    const row = makeMovieRow({ genres: null });
    expect(toMovieDataSummary(row).genres).toEqual([]);
  });

  it("keeps cast names in billed order", () => {
    const row = makeMovieRow({
      cast_names: ["Leonardo DiCaprio", "Joseph Gordon-Levitt", "Elliot Page"],
    });
    expect(toMovieDataSummary(row).castNames).toEqual([
      "Leonardo DiCaprio",
      "Joseph Gordon-Levitt",
      "Elliot Page",
    ]);
  });

  it("returns an empty array for cast names when null", () => {
    const row = makeMovieRow({ cast_names: null });
    expect(toMovieDataSummary(row).castNames).toEqual([]);
  });

  it("drops empty cast names left by the aggregate join", () => {
    const row = makeMovieRow({ cast_names: ["Leonardo DiCaprio", ""] });
    expect(toMovieDataSummary(row).castNames).toEqual(["Leonardo DiCaprio"]);
  });

  it("passes through a populated directors array", () => {
    const row = makeMovieRow({
      directors: [{ name: "Christopher Nolan", profilePath: null }],
    });
    const result = toMovieDataSummary(row);
    expect(result.directors).toHaveLength(1);
    expect(result.directors[0]?.name).toBe("Christopher Nolan");
  });

  it("returns an empty array for directors when null", () => {
    const row = makeMovieRow({ directors: null });
    expect(toMovieDataSummary(row).directors).toEqual([]);
  });

  it("passes through populated production_companies", () => {
    const row = makeMovieRow({
      production_companies: ["Warner Bros.", "Legendary"],
    });
    expect(toMovieDataSummary(row).production_companies).toEqual(["Warner Bros.", "Legendary"]);
  });

  it("returns an empty array for production_companies when null", () => {
    const row = makeMovieRow({ production_companies: null });
    expect(toMovieDataSummary(row).production_companies).toEqual([]);
  });

  it("passes through populated production_countries", () => {
    const row = makeMovieRow({
      production_countries: ["United States of America"],
    });
    expect(toMovieDataSummary(row).production_countries).toEqual(["United States of America"]);
  });

  it("returns an empty array for production_countries when null", () => {
    const row = makeMovieRow({ production_countries: null });
    expect(toMovieDataSummary(row).production_countries).toEqual([]);
  });
});
