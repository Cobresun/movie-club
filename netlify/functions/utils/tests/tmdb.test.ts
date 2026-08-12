/**
 * Tests for netlify/functions/utils/tmdb.ts
 *
 * Real axios against MSW-faked HTTP: `netlify/functions/tests/mocks/handlers.ts`
 * answers `/configuration` and `/movie/:id` with the default fixtures, and a
 * test overrides them with `server.use` when it needs a different body. The
 * fixture is derived from the requested id, so asserting on the returned movie
 * is also what proves the right id was fetched.
 */
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WorkType } from "../../../../lib/types/generated/db";
import { TMDBMovieData } from "../../../../lib/types/movie";
import { TMDB_IMAGE_BASE_URL, tmdbMovie } from "../../tests/fixtures/external";
import { server } from "../../tests/mocks/server";

const MOVIE_URL = "https://api.themoviedb.org/3/movie/:movieId";

// tmdb.ts memoizes the /configuration response in a module-scoped promise, so
// each test re-imports the module to get that cache cleared.
async function importTmdb() {
  const mod = await import("../tmdb");
  return mod;
}

/** Serve `/movie/:id` with the default fixture, altered by `overrides`. */
function respondWithMovie(overrides: Partial<TMDBMovieData>) {
  server.use(
    http.get(MOVIE_URL, ({ params }) =>
      HttpResponse.json(tmdbMovie(Number(params.movieId), overrides)),
    ),
  );
}

function movieWork(externalId?: string) {
  return {
    id: `work-${externalId ?? "none"}`,
    type: WorkType.movie,
    title: "Inception",
    createdDate: "2024-01-01",
    ...(externalId === undefined ? {} : { externalId }),
  };
}

beforeEach(() => {
  vi.stubEnv("TMDB_API_KEY", "test-api-key");
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ---------------------------------------------------------------------------
// getTMDBMovieData
// ---------------------------------------------------------------------------

describe("getTMDBMovieData", () => {
  it("returns the TMDB body for the requested movie", async () => {
    const { getTMDBMovieData } = await importTmdb();

    const result = await getTMDBMovieData(27205);

    expect(result.data).toEqual(tmdbMovie(27205));
  });

  it("propagates TMDB errors", async () => {
    const { getTMDBMovieData } = await importTmdb();
    server.use(
      http.get(MOVIE_URL, () =>
        HttpResponse.json({ status_message: "Not found" }, { status: 404 }),
      ),
    );

    await expect(getTMDBMovieData(27205)).rejects.toThrow("Request failed with status code 404");
  });

  it("propagates transport failures", async () => {
    const { getTMDBMovieData } = await importTmdb();
    server.use(http.get(MOVIE_URL, () => HttpResponse.error()));

    await expect(getTMDBMovieData(27205)).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// getDetailedMovie
// ---------------------------------------------------------------------------

describe("getDetailedMovie", () => {
  it("returns an empty array when called with no movies", async () => {
    const { getDetailedMovie } = await importTmdb();

    const result = await getDetailedMovie([]);

    expect(result).toEqual([]);
  });

  it("merges TMDB data into each movie object", async () => {
    const { getDetailedMovie } = await importTmdb();

    const result = await getDetailedMovie([{ movieId: 27205 }]);

    expect(result).toHaveLength(1);
    expect(result[0]?.movieTitle).toBe("Movie 27205");
  });

  it("builds posterUrl from config secure_base_url + w154 + poster_path", async () => {
    const { getDetailedMovie } = await importTmdb();
    respondWithMovie({ poster_path: "/poster.jpg" });

    const result = await getDetailedMovie([{ movieId: 27205 }]);

    expect(result[0]?.posterUrl).toBe(`${TMDB_IMAGE_BASE_URL}w154/poster.jpg`);
  });

  it("maps cast to actors sorted by order with profilePath", async () => {
    const { getDetailedMovie } = await importTmdb();

    const result = await getDetailedMovie([{ movieId: 27205 }]);
    const actors = result[0]?.movieData.actors ?? [];

    expect(actors[0]?.name).toBe("Lead 27205");
    expect(actors[0]?.profilePath).toBe("/lead-27205.jpg");
    expect(actors[1]?.name).toBe("Support 27205");
    expect(actors[1]?.profilePath).toBeNull();
  });

  it("filters crew to only Directors", async () => {
    const { getDetailedMovie } = await importTmdb();

    const result = await getDetailedMovie([{ movieId: 27205 }]);
    const directors = result[0]?.movieData.directors ?? [];

    expect(directors).toHaveLength(1);
    expect(directors[0]?.name).toBe("Director 27205");
  });

  it("maps genres to string array", async () => {
    const { getDetailedMovie } = await importTmdb();
    respondWithMovie({
      genres: [
        { id: 28, name: "Action" },
        { id: 878, name: "Science Fiction" },
      ],
    });

    const result = await getDetailedMovie([{ movieId: 27205 }]);

    expect(result[0]?.movieData.genres).toEqual(["Action", "Science Fiction"]);
  });

  it("maps production_companies to name strings", async () => {
    const { getDetailedMovie } = await importTmdb();

    const result = await getDetailedMovie([{ movieId: 27205 }]);

    expect(result[0]?.movieData.production_companies).toEqual(["Studio 27205"]);
  });

  it("maps production_countries to name strings", async () => {
    const { getDetailedMovie } = await importTmdb();

    const result = await getDetailedMovie([{ movieId: 27205 }]);

    expect(result[0]?.movieData.production_countries).toEqual(["United States of America"]);
  });

  it("parses vote_average string to float", async () => {
    const { getDetailedMovie } = await importTmdb();
    respondWithMovie({ vote_average: "8.36" });

    const result = await getDetailedMovie([{ movieId: 27205 }]);

    expect(result[0]?.movieData.vote_average).toBe(8.36);
  });

  it("preserves extra properties from the input movie object", async () => {
    const { getDetailedMovie } = await importTmdb();

    const result = await getDetailedMovie([{ movieId: 27205, customField: "kept" }]);

    expect(result[0]).toMatchObject({ customField: "kept" });
  });

  it("handles movies with no credits gracefully", async () => {
    const { getDetailedMovie } = await importTmdb();
    respondWithMovie({ credits: undefined });

    const result = await getDetailedMovie([{ movieId: 27205 }]);

    expect(result[0]?.movieData.actors).toEqual([]);
    expect(result[0]?.movieData.directors).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getDetailedWorks
// ---------------------------------------------------------------------------

describe("getDetailedWorks", () => {
  it("returns an empty array when called with no works", async () => {
    const { getDetailedWorks } = await importTmdb();

    const result = await getDetailedWorks([]);

    expect(result).toEqual([]);
  });

  it("attaches externalData to works that have an externalId", async () => {
    const { getDetailedWorks } = await importTmdb();

    const result = await getDetailedWorks([movieWork("27205")]);

    expect(result).toHaveLength(1);
    expect(result[0]?.externalData).toEqual(tmdbMovie(27205));
  });

  it("leaves works without an externalId unchanged", async () => {
    const { getDetailedWorks } = await importTmdb();
    const work = movieWork();

    const result = await getDetailedWorks([work]);

    expect(result).toEqual([work]);
  });

  it("leaves works with an empty externalId unchanged", async () => {
    const { getDetailedWorks } = await importTmdb();
    const work = movieWork("");

    const result = await getDetailedWorks([work]);

    expect(result).toEqual([work]);
  });

  it("processes multiple works in parallel", async () => {
    const { getDetailedWorks } = await importTmdb();

    const result = await getDetailedWorks([movieWork("27205"), movieWork("550")]);

    expect(result).toHaveLength(2);
    expect(result[0]?.externalData?.title).toBe("Movie 27205");
    expect(result[1]?.externalData?.title).toBe("Movie 550");
  });

  it("propagates TMDB fetch errors", async () => {
    const { getDetailedWorks } = await importTmdb();
    server.use(http.get(MOVIE_URL, () => HttpResponse.error()));

    await expect(getDetailedWorks([movieWork("27205")])).rejects.toThrow();
  });
});
