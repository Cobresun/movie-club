import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WorkType } from "../../../../lib/types/generated/db";
import { TMDBConfig, TMDBMovieData } from "../../../../lib/types/movie";

// Vitest hoists vi.mock above all imports, so axios is intercepted before
// tmdb.ts binds to it regardless of statement order.
vi.mock("axios");

// ---------------------------------------------------------------------------
// Helpers to rebuild mocked imports after each module reset
// ---------------------------------------------------------------------------

// We re-import the module under test via a helper so each describe block gets
// a fresh copy with the module-scoped tmdbConfigPromise cleared.
async function importTmdb() {
  const mod = await import("../tmdb");
  return mod;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeTMDBMovieData(
  overrides: Partial<TMDBMovieData> = {},
): TMDBMovieData {
  return {
    adult: false,
    backdrop_path: "/backdrop.jpg",
    budget: 160000000,
    genres: [
      { id: 28, name: "Action" },
      { id: 878, name: "Science Fiction" },
    ],
    homepage: "https://example.com",
    id: 27205,
    imdb_id: "tt1375666",
    original_language: "en",
    original_title: "Inception",
    overview:
      "Cobb steals information from his targets by entering their dreams.",
    popularity: 87.3,
    poster_path: "/poster.jpg",
    production_companies: [
      {
        id: 174,
        logo_path: "/wWarner.png",
        name: "Warner Bros.",
        origin_country: "US",
      },
    ],
    production_countries: [
      { iso_3166_1: "US", name: "United States of America" },
    ],
    release_date: "2010-07-16",
    revenue: 836836967,
    runtime: 148,
    spoken_languages: [
      { english_name: "English", iso_639_1: "en", name: "English" },
    ],
    status: "Released",
    tagline: "Your mind is the scene of the crime.",
    title: "Inception",
    video: false,
    vote_average: "8.4",
    vote_count: 35000,
    credits: {
      cast: [
        {
          id: 6193,
          name: "Leonardo DiCaprio",
          character: "Cobb",
          order: 0,
          profile_path: "/wo2hJpn04vbtmh0B9utCFdsQhxM.jpg",
        },
        {
          id: 24045,
          name: "Joseph Gordon-Levitt",
          character: "Arthur",
          order: 1,
          profile_path: null,
        },
      ],
      crew: [
        {
          id: 525,
          name: "Christopher Nolan",
          job: "Director",
          department: "Directing",
          profile_path: "/xuAIuYSmsUzKlUMBFGVZaWsY3DZ.jpg",
        },
        {
          id: 1234,
          name: "Emma Thomas",
          job: "Producer",
          department: "Production",
          profile_path: null,
        },
      ],
    },
    ...overrides,
  };
}

function makeTMDBConfig(): TMDBConfig {
  return {
    images: {
      base_url: "http://image.tmdb.org/t/p/",
      secure_base_url: "https://image.tmdb.org/t/p/",
      backdrop_sizes: ["w300", "w780", "w1280", "original"],
      logo_sizes: ["w45", "w92", "w154", "w185", "w300", "w500", "original"],
      poster_sizes: ["w92", "w154", "w185", "w342", "w500", "w780", "original"],
      profile_sizes: ["w45", "w185", "h632", "original"],
      still_sizes: ["w92", "w185", "w300", "original"],
    },
    change_keys: ["adult", "air_date", "also_known_as"],
  };
}

// ---------------------------------------------------------------------------
// getTMDBMovieData
// ---------------------------------------------------------------------------

describe("getTMDBMovieData", () => {
  const axiosGetMock = vi.mocked(axios.get);

  beforeEach(() => {
    vi.stubEnv("TMDB_API_KEY", "test-api-key");
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetAllMocks();
  });

  it("calls the correct TMDB movie endpoint with the movie id", async () => {
    const { getTMDBMovieData } = await importTmdb();
    axiosGetMock.mockResolvedValueOnce({
      data: makeTMDBMovieData(),
      status: 200,
    });

    await getTMDBMovieData(27205);

    const calledUrl = axiosGetMock.mock.calls[0]?.[0] ?? "";
    expect(calledUrl).toContain("/movie/27205");
  });

  it("includes the api_key query param", async () => {
    const { getTMDBMovieData } = await importTmdb();
    axiosGetMock.mockResolvedValueOnce({
      data: makeTMDBMovieData(),
      status: 200,
    });

    await getTMDBMovieData(27205);

    const calledUrl = axiosGetMock.mock.calls[0]?.[0] ?? "";
    expect(calledUrl).toContain("api_key=test-api-key");
  });

  it("appends credits via append_to_response", async () => {
    const { getTMDBMovieData } = await importTmdb();
    axiosGetMock.mockResolvedValueOnce({
      data: makeTMDBMovieData(),
      status: 200,
    });

    await getTMDBMovieData(27205);

    const calledUrl = axiosGetMock.mock.calls[0]?.[0] ?? "";
    expect(calledUrl).toContain("append_to_response=credits");
  });

  it("returns the axios response from TMDB", async () => {
    const { getTMDBMovieData } = await importTmdb();
    const tmdbData = makeTMDBMovieData();
    axiosGetMock.mockResolvedValueOnce({ data: tmdbData, status: 200 });

    const result = await getTMDBMovieData(27205);

    expect(result.data).toEqual(tmdbData);
  });

  it("propagates axios errors", async () => {
    const { getTMDBMovieData } = await importTmdb();
    axiosGetMock.mockRejectedValueOnce(new Error("network error"));

    await expect(getTMDBMovieData(27205)).rejects.toThrow("network error");
  });

  it("uses an empty string for api_key when TMDB_API_KEY is not set", async () => {
    vi.unstubAllEnvs();
    const { getTMDBMovieData } = await importTmdb();
    axiosGetMock.mockResolvedValueOnce({
      data: makeTMDBMovieData(),
      status: 200,
    });

    await getTMDBMovieData(27205);

    const calledUrl = axiosGetMock.mock.calls[0]?.[0] ?? "";
    // api_key param is present but empty
    expect(calledUrl).toContain("api_key=");
  });
});

// ---------------------------------------------------------------------------
// getDetailedMovie
// Each test resets modules to clear the module-scoped tmdbConfigPromise cache
// so every test controls the full sequence of axios.get calls.
// ---------------------------------------------------------------------------

describe("getDetailedMovie", () => {
  const axiosGetMock = vi.mocked(axios.get);

  beforeEach(() => {
    vi.stubEnv("TMDB_API_KEY", "test-api-key");
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetAllMocks();
  });

  it("returns an empty array when called with no movies", async () => {
    const { getDetailedMovie } = await importTmdb();
    axiosGetMock.mockResolvedValueOnce({
      data: makeTMDBConfig(),
      status: 200,
    });

    const result = await getDetailedMovie([]);

    expect(result).toEqual([]);
  });

  it("merges TMDB data into each movie object", async () => {
    const { getDetailedMovie } = await importTmdb();
    axiosGetMock
      .mockResolvedValueOnce({ data: makeTMDBConfig(), status: 200 })
      .mockResolvedValueOnce({
        data: makeTMDBMovieData({ title: "Inception" }),
        status: 200,
      });

    const result = await getDetailedMovie([{ movieId: 27205 }]);

    expect(result).toHaveLength(1);
    expect(result[0]?.movieTitle).toBe("Inception");
  });

  it("builds posterUrl from config secure_base_url + w154 + poster_path", async () => {
    const { getDetailedMovie } = await importTmdb();
    axiosGetMock
      .mockResolvedValueOnce({ data: makeTMDBConfig(), status: 200 })
      .mockResolvedValueOnce({
        data: makeTMDBMovieData({ poster_path: "/poster.jpg" }),
        status: 200,
      });

    const result = await getDetailedMovie([{ movieId: 27205 }]);

    expect(result[0]?.posterUrl).toBe(
      "https://image.tmdb.org/t/p/w154/poster.jpg",
    );
  });

  it("maps cast to actors sorted by order with profilePath", async () => {
    const { getDetailedMovie } = await importTmdb();
    axiosGetMock
      .mockResolvedValueOnce({ data: makeTMDBConfig(), status: 200 })
      .mockResolvedValueOnce({ data: makeTMDBMovieData(), status: 200 });

    const result = await getDetailedMovie([{ movieId: 27205 }]);
    const actors = result[0]?.movieData.actors ?? [];

    expect(actors[0]?.name).toBe("Leonardo DiCaprio");
    expect(actors[0]?.profilePath).toBe("/wo2hJpn04vbtmh0B9utCFdsQhxM.jpg");
    expect(actors[1]?.name).toBe("Joseph Gordon-Levitt");
    expect(actors[1]?.profilePath).toBeNull();
  });

  it("filters crew to only Directors", async () => {
    const { getDetailedMovie } = await importTmdb();
    axiosGetMock
      .mockResolvedValueOnce({ data: makeTMDBConfig(), status: 200 })
      .mockResolvedValueOnce({ data: makeTMDBMovieData(), status: 200 });

    const result = await getDetailedMovie([{ movieId: 27205 }]);
    const directors = result[0]?.movieData.directors ?? [];

    expect(directors).toHaveLength(1);
    expect(directors[0]?.name).toBe("Christopher Nolan");
  });

  it("maps genres to string array", async () => {
    const { getDetailedMovie } = await importTmdb();
    axiosGetMock
      .mockResolvedValueOnce({ data: makeTMDBConfig(), status: 200 })
      .mockResolvedValueOnce({ data: makeTMDBMovieData(), status: 200 });

    const result = await getDetailedMovie([{ movieId: 27205 }]);

    expect(result[0]?.movieData.genres).toEqual(["Action", "Science Fiction"]);
  });

  it("maps production_companies to name strings", async () => {
    const { getDetailedMovie } = await importTmdb();
    axiosGetMock
      .mockResolvedValueOnce({ data: makeTMDBConfig(), status: 200 })
      .mockResolvedValueOnce({ data: makeTMDBMovieData(), status: 200 });

    const result = await getDetailedMovie([{ movieId: 27205 }]);

    expect(result[0]?.movieData.production_companies).toEqual(["Warner Bros."]);
  });

  it("maps production_countries to name strings", async () => {
    const { getDetailedMovie } = await importTmdb();
    axiosGetMock
      .mockResolvedValueOnce({ data: makeTMDBConfig(), status: 200 })
      .mockResolvedValueOnce({ data: makeTMDBMovieData(), status: 200 });

    const result = await getDetailedMovie([{ movieId: 27205 }]);

    expect(result[0]?.movieData.production_countries).toEqual([
      "United States of America",
    ]);
  });

  it("parses vote_average string to float", async () => {
    const { getDetailedMovie } = await importTmdb();
    axiosGetMock
      .mockResolvedValueOnce({ data: makeTMDBConfig(), status: 200 })
      .mockResolvedValueOnce({
        data: makeTMDBMovieData({ vote_average: "8.36" }),
        status: 200,
      });

    const result = await getDetailedMovie([{ movieId: 27205 }]);

    expect(result[0]?.movieData.vote_average).toBe(8.36);
  });

  it("preserves extra properties from the input movie object", async () => {
    const { getDetailedMovie } = await importTmdb();
    axiosGetMock
      .mockResolvedValueOnce({ data: makeTMDBConfig(), status: 200 })
      .mockResolvedValueOnce({ data: makeTMDBMovieData(), status: 200 });

    const input = { movieId: 27205, customField: "kept" };
    const result = await getDetailedMovie([input]);

    expect(
      (result[0] as typeof input & { movieTitle: string }).customField,
    ).toBe("kept");
  });

  it("handles movies with no credits gracefully", async () => {
    const { getDetailedMovie } = await importTmdb();
    axiosGetMock
      .mockResolvedValueOnce({ data: makeTMDBConfig(), status: 200 })
      .mockResolvedValueOnce({
        data: makeTMDBMovieData({ credits: undefined }),
        status: 200,
      });

    const result = await getDetailedMovie([{ movieId: 27205 }]);

    expect(result[0]?.movieData.actors).toEqual([]);
    expect(result[0]?.movieData.directors).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getDetailedWorks
// ---------------------------------------------------------------------------

describe("getDetailedWorks", () => {
  const axiosGetMock = vi.mocked(axios.get);

  beforeEach(() => {
    vi.stubEnv("TMDB_API_KEY", "test-api-key");
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetAllMocks();
  });

  it("returns an empty array when called with no works", async () => {
    const { getDetailedWorks } = await importTmdb();

    const result = await getDetailedWorks([]);

    expect(result).toEqual([]);
  });

  it("attaches externalData to works that have an externalId", async () => {
    const { getDetailedWorks } = await importTmdb();
    const tmdbData = makeTMDBMovieData();
    axiosGetMock.mockResolvedValueOnce({ data: tmdbData, status: 200 });

    const work = {
      id: "work-1",
      type: WorkType.movie,
      title: "Inception",
      createdDate: "2024-01-01",
      externalId: "27205",
    };

    const result = await getDetailedWorks([work]);

    expect(result).toHaveLength(1);
    expect(result[0]?.externalData).toEqual(tmdbData);
  });

  it("leaves works without an externalId unchanged", async () => {
    const { getDetailedWorks } = await importTmdb();
    const work = {
      id: "work-2",
      type: WorkType.movie,
      title: "Unknown",
      createdDate: "2024-01-01",
    };

    const result = await getDetailedWorks([work]);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(work);
    expect(axiosGetMock).not.toHaveBeenCalled();
  });

  it("leaves works with an empty externalId unchanged", async () => {
    const { getDetailedWorks } = await importTmdb();
    const work = {
      id: "work-3",
      type: WorkType.movie,
      title: "No ID",
      createdDate: "2024-01-01",
      externalId: "",
    };

    const result = await getDetailedWorks([work]);

    expect(result).toHaveLength(1);
    expect(axiosGetMock).not.toHaveBeenCalled();
  });

  it("processes multiple works in parallel", async () => {
    const { getDetailedWorks } = await importTmdb();
    const tmdbData1 = makeTMDBMovieData({ id: 27205, title: "Inception" });
    const tmdbData2 = makeTMDBMovieData({ id: 550, title: "Fight Club" });
    axiosGetMock
      .mockResolvedValueOnce({ data: tmdbData1, status: 200 })
      .mockResolvedValueOnce({ data: tmdbData2, status: 200 });

    const works = [
      {
        id: "w1",
        type: WorkType.movie,
        title: "Inception",
        createdDate: "2024-01-01",
        externalId: "27205",
      },
      {
        id: "w2",
        type: WorkType.movie,
        title: "Fight Club",
        createdDate: "2024-01-01",
        externalId: "550",
      },
    ];

    const result = await getDetailedWorks(works);

    expect(result).toHaveLength(2);
    expect(result[0]?.externalData?.title).toBe("Inception");
    expect(result[1]?.externalData?.title).toBe("Fight Club");
  });

  it("propagates TMDB fetch errors", async () => {
    const { getDetailedWorks } = await importTmdb();
    axiosGetMock.mockRejectedValueOnce(new Error("TMDB down"));

    const work = {
      id: "w1",
      type: WorkType.movie,
      title: "Inception",
      createdDate: "2024-01-01",
      externalId: "27205",
    };

    await expect(getDetailedWorks([work])).rejects.toThrow("TMDB down");
  });
});
