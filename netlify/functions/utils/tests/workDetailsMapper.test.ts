import { describe, expect, it } from "vitest";

import { WorkType } from "../../../../lib/types/generated/db";
import { overviewToExternalData } from "../workDetailsMapper";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/**
 * Minimal shape matching what ListRepository.getWorkDetails returns.
 * All nullable/optional columns that overviewToExternalData actually reads are
 * represented here — we build typed objects rather than using `as` casts.
 */
type WorkDetailsLike = Parameters<typeof overviewToExternalData>[0];

function makeWorkDetails(
  overrides: Partial<NonNullable<WorkDetailsLike>> = {},
): NonNullable<WorkDetailsLike> {
  return {
    id: "work-1",
    title: "Inception",
    type: WorkType.movie,
    image_url: null,
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
    overview:
      "Cobb steals information from his targets by entering their dreams.",
    popularity: "87.3",
    poster_path: "/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg",
    status: "Released",
    tagline: "Your mind is the scene of the crime.",
    genres: ["Action", "Science Fiction", "Adventure"],
    production_companies: ["Warner Bros.", "Legendary Entertainment"],
    production_countries: ["United States of America", "United Kingdom"],
    directors: [{ name: "Christopher Nolan", profilePath: null }],
    actors: [
      {
        name: "Leonardo DiCaprio",
        profilePath: "/wo2hJpn04vbtmh0B9utCFdsQhxM.jpg",
      },
      { name: "Joseph Gordon-Levitt", profilePath: null },
    ],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// overviewToExternalData — null/undefined guard
// ---------------------------------------------------------------------------

describe("overviewToExternalData — returns undefined", () => {
  it("returns undefined when called with undefined", () => {
    expect(overviewToExternalData(undefined)).toBeUndefined();
  });

  it("returns undefined when overview is null", () => {
    const details = makeWorkDetails({ overview: null });
    expect(overviewToExternalData(details)).toBeUndefined();
  });

  it("returns undefined when overview is an empty string", () => {
    const details = makeWorkDetails({ overview: "" });
    expect(overviewToExternalData(details)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// overviewToExternalData — happy-path field mapping
// ---------------------------------------------------------------------------

describe("overviewToExternalData — field mapping", () => {
  it("returns a defined object for a fully-populated work", () => {
    expect(overviewToExternalData(makeWorkDetails())).toBeDefined();
  });

  it("maps overview directly", () => {
    const details = makeWorkDetails({
      overview:
        "Cobb steals information from his targets by entering their dreams.",
    });
    expect(overviewToExternalData(details)?.overview).toBe(
      "Cobb steals information from his targets by entering their dreams.",
    );
  });

  it("converts tmdb_score string to a float for vote_average", () => {
    const details = makeWorkDetails({ tmdb_score: "8.36" });
    expect(overviewToExternalData(details)?.vote_average).toBe(8.36);
  });

  it("sets vote_average to undefined when tmdb_score is null", () => {
    const details = makeWorkDetails({ tmdb_score: null });
    expect(overviewToExternalData(details)?.vote_average).toBeUndefined();
  });

  it("converts release_date Date to an ISO string", () => {
    const date = new Date("2010-07-16");
    const details = makeWorkDetails({ release_date: date });
    expect(overviewToExternalData(details)?.release_date).toBe(
      date.toISOString(),
    );
  });

  it("sets release_date to undefined when it is null", () => {
    const details = makeWorkDetails({ release_date: null });
    expect(overviewToExternalData(details)?.release_date).toBeUndefined();
  });

  it("passes through scalar fields unchanged", () => {
    const details = makeWorkDetails({
      adult: true,
      backdrop_path: "/backdrop.jpg",
      budget: "160000000",
      homepage: "https://example.com",
      imdb_id: "tt1375666",
      original_language: "en",
      original_title: "Inception",
      popularity: "87.3",
      poster_path: "/poster.jpg",
      revenue: "836836967",
      runtime: "148",
      status: "Released",
      tagline: "Your mind is the scene of the crime.",
    });
    const result = overviewToExternalData(details);
    expect(result?.adult).toBe(true);
    expect(result?.backdrop_path).toBe("/backdrop.jpg");
    expect(result?.budget).toBe("160000000");
    expect(result?.homepage).toBe("https://example.com");
    expect(result?.imdb_id).toBe("tt1375666");
    expect(result?.original_language).toBe("en");
    expect(result?.original_title).toBe("Inception");
    expect(result?.popularity).toBe("87.3");
    expect(result?.poster_path).toBe("/poster.jpg");
    expect(result?.revenue).toBe("836836967");
    expect(result?.runtime).toBe("148");
    expect(result?.status).toBe("Released");
    expect(result?.tagline).toBe("Your mind is the scene of the crime.");
  });
});

// ---------------------------------------------------------------------------
// overviewToExternalData — array handling
// ---------------------------------------------------------------------------

describe("overviewToExternalData — array handling", () => {
  it("includes genres when present", () => {
    const details = makeWorkDetails({ genres: ["Drama", "Thriller"] });
    expect(overviewToExternalData(details)?.genres).toEqual([
      "Drama",
      "Thriller",
    ]);
  });

  it("returns empty array for genres when null", () => {
    const details = makeWorkDetails({ genres: null });
    expect(overviewToExternalData(details)?.genres).toEqual([]);
  });

  it("returns empty array for genres when undefined", () => {
    const details = makeWorkDetails({ genres: undefined });
    expect(overviewToExternalData(details)?.genres).toEqual([]);
  });

  it("passes through a populated actors array", () => {
    const details = makeWorkDetails({
      actors: [
        { name: "Leonardo DiCaprio", profilePath: null },
        { name: "Joseph Gordon-Levitt", profilePath: null },
      ],
    });
    const result = overviewToExternalData(details);
    expect(result?.actors).toEqual([
      { name: "Leonardo DiCaprio", profilePath: null },
      { name: "Joseph Gordon-Levitt", profilePath: null },
    ]);
  });

  it("returns empty array for actors when null", () => {
    const details = makeWorkDetails({ actors: null });
    expect(overviewToExternalData(details)?.actors).toEqual([]);
  });

  it("passes through a populated directors array", () => {
    const details = makeWorkDetails({
      directors: [{ name: "Christopher Nolan", profilePath: null }],
    });
    const result = overviewToExternalData(details);
    expect(result?.directors).toHaveLength(1);
    expect(result?.directors[0]?.name).toBe("Christopher Nolan");
  });

  it("returns empty array for directors when null", () => {
    const details = makeWorkDetails({ directors: null });
    expect(overviewToExternalData(details)?.directors).toEqual([]);
  });

  it("passes through populated production_companies", () => {
    const details = makeWorkDetails({
      production_companies: ["Warner Bros.", "Legendary"],
    });
    const result = overviewToExternalData(details);
    expect(result?.production_companies).toEqual(["Warner Bros.", "Legendary"]);
  });

  it("returns empty array for production_companies when null", () => {
    const details = makeWorkDetails({ production_companies: null });
    expect(overviewToExternalData(details)?.production_companies).toEqual([]);
  });

  it("passes through populated production_countries", () => {
    const details = makeWorkDetails({
      production_countries: ["United States of America"],
    });
    const result = overviewToExternalData(details);
    expect(result?.production_countries).toEqual(["United States of America"]);
  });

  it("returns empty array for production_countries when null", () => {
    const details = makeWorkDetails({ production_countries: null });
    expect(overviewToExternalData(details)?.production_countries).toEqual([]);
  });
});
