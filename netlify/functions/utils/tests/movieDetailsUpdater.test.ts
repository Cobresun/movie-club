/**
 * Tests for netlify/functions/utils/movieDetailsUpdater.ts
 *
 * insertMovieDetails and updateMovieDetails accept a Kysely db/transaction
 * object. We drive them against a real `Kysely<DB>` backed by Kysely's
 * `DummyDriver`, so queries compile (and `.execute()` resolves) without ever
 * touching a database. A `log` hook records each compiled query, letting the
 * tests assert on the actual SQL that would run:
 *
 *  - the correct tables are written to
 *  - delete-then-insert strategy is used for update paths
 *  - optional arrays (genres, companies, etc.) are skipped when empty
 *  - production_companies are de-duplicated by name on update
 */
import {
  CompiledQuery,
  DummyDriver,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
} from "kysely";
import { describe, expect, it } from "vitest";

import { DB } from "../../../../lib/types/generated/db";
import { TMDBMovieData } from "../../../../lib/types/movie";
import { insertMovieDetails, updateMovieDetails } from "../movieDetailsUpdater";

// ─── Real Kysely over a no-op driver ─────────────────────────────────────────
// DummyDriver compiles and "executes" queries without a connection; the `log`
// hook collects every compiled query in execution order.

function makeDb() {
  const queries: CompiledQuery[] = [];
  const db = new Kysely<DB>({
    dialect: {
      createAdapter: () => new PostgresAdapter(),
      createDriver: () => new DummyDriver(),
      createIntrospector: (database) => new PostgresIntrospector(database),
      createQueryCompiler: () => new PostgresQueryCompiler(),
    },
    log: (event) => {
      if (event.level === "query") queries.push(event.query);
    },
  });

  const didInsert = (table: keyof DB) =>
    queries.some((q) => q.sql.includes(`insert into "${table}"`));
  const didUpdate = (table: keyof DB) =>
    queries.some((q) => q.sql.includes(`update "${table}"`));
  const didDelete = (table: keyof DB) =>
    queries.some((q) => q.sql.includes(`delete from "${table}"`));

  return { db, queries, didInsert, didUpdate, didDelete };
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeTMDBData(overrides: Partial<TMDBMovieData> = {}): TMDBMovieData {
  return {
    adult: false,
    backdrop_path: "/backdrop.jpg",
    budget: 160000000,
    genres: [{ id: 28, name: "Action" }],
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
        logo_path: "/logo.png",
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
          profile_path: null,
        },
      ],
      crew: [
        {
          id: 525,
          name: "Christopher Nolan",
          job: "Director",
          department: "Directing",
          profile_path: null,
        },
        {
          id: 999,
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

// ─── insertMovieDetails ───────────────────────────────────────────────────────

describe("insertMovieDetails", () => {
  it("inserts into movie_details", async () => {
    const { db, didInsert } = makeDb();
    await insertMovieDetails("27205", makeTMDBData(), db);
    expect(didInsert("movie_details")).toBe(true);
  });

  it("inserts genres when genres array is non-empty", async () => {
    const { db, didInsert } = makeDb();
    await insertMovieDetails("27205", makeTMDBData(), db);
    expect(didInsert("movie_genres")).toBe(true);
  });

  it("skips genres insert when genres array is empty", async () => {
    const { db, didInsert } = makeDb();
    await insertMovieDetails("27205", makeTMDBData({ genres: [] }), db);
    expect(didInsert("movie_genres")).toBe(false);
  });

  it("inserts production_companies when non-empty", async () => {
    const { db, didInsert } = makeDb();
    await insertMovieDetails("27205", makeTMDBData(), db);
    expect(didInsert("movie_production_companies")).toBe(true);
  });

  it("skips production_companies insert when empty", async () => {
    const { db, didInsert } = makeDb();
    await insertMovieDetails(
      "27205",
      makeTMDBData({ production_companies: [] }),
      db,
    );
    expect(didInsert("movie_production_companies")).toBe(false);
  });

  it("inserts production_countries when non-empty", async () => {
    const { db, didInsert } = makeDb();
    await insertMovieDetails("27205", makeTMDBData(), db);
    expect(didInsert("movie_production_countries")).toBe(true);
  });

  it("skips production_countries insert when empty", async () => {
    const { db, didInsert } = makeDb();
    await insertMovieDetails(
      "27205",
      makeTMDBData({ production_countries: [] }),
      db,
    );
    expect(didInsert("movie_production_countries")).toBe(false);
  });

  it("inserts directors filtering crew by job=Director", async () => {
    const { db, didInsert } = makeDb();
    await insertMovieDetails("27205", makeTMDBData(), db);
    expect(didInsert("movie_directors")).toBe(true);
  });

  it("skips directors insert when no crew with job Director", async () => {
    const { db, didInsert } = makeDb();
    const dataNoDirector = makeTMDBData({
      credits: {
        cast: [],
        crew: [
          {
            id: 999,
            name: "Emma Thomas",
            job: "Producer",
            department: "Production",
            profile_path: null,
          },
        ],
      },
    });
    await insertMovieDetails("27205", dataNoDirector, db);
    expect(didInsert("movie_directors")).toBe(false);
  });

  it("inserts actors when cast is non-empty", async () => {
    const { db, didInsert } = makeDb();
    await insertMovieDetails("27205", makeTMDBData(), db);
    expect(didInsert("movie_actors")).toBe(true);
  });

  it("skips actors insert when cast is empty", async () => {
    const { db, didInsert } = makeDb();
    const dataNoActors = makeTMDBData({ credits: { cast: [], crew: [] } });
    await insertMovieDetails("27205", dataNoActors, db);
    expect(didInsert("movie_actors")).toBe(false);
  });

  it("handles missing credits gracefully (no actors/directors insert)", async () => {
    const { db, didInsert } = makeDb();
    await insertMovieDetails("27205", makeTMDBData({ credits: undefined }), db);
    expect(didInsert("movie_actors")).toBe(false);
    expect(didInsert("movie_directors")).toBe(false);
  });
});

// ─── updateMovieDetails ───────────────────────────────────────────────────────

describe("updateMovieDetails", () => {
  it("updates movie_details table", async () => {
    const { db, didUpdate } = makeDb();
    await updateMovieDetails("27205", makeTMDBData(), db);
    expect(didUpdate("movie_details")).toBe(true);
  });

  it("deletes and re-inserts genres", async () => {
    const { db, didInsert, didDelete } = makeDb();
    await updateMovieDetails("27205", makeTMDBData(), db);
    expect(didDelete("movie_genres")).toBe(true);
    expect(didInsert("movie_genres")).toBe(true);
  });

  it("deletes the old genres before re-inserting", async () => {
    const { db, queries } = makeDb();
    await updateMovieDetails("27205", makeTMDBData(), db);
    const deleteIndex = queries.findIndex((q) =>
      q.sql.includes(`delete from "movie_genres"`),
    );
    const insertIndex = queries.findIndex((q) =>
      q.sql.includes(`insert into "movie_genres"`),
    );
    expect(deleteIndex).toBeGreaterThanOrEqual(0);
    expect(insertIndex).toBeGreaterThan(deleteIndex);
  });

  it("deletes genres but skips re-insert when genres array is empty", async () => {
    const { db, didInsert, didDelete } = makeDb();
    await updateMovieDetails("27205", makeTMDBData({ genres: [] }), db);
    expect(didDelete("movie_genres")).toBe(true);
    expect(didInsert("movie_genres")).toBe(false);
  });

  it("deletes and re-inserts directors", async () => {
    const { db, didInsert, didDelete } = makeDb();
    await updateMovieDetails("27205", makeTMDBData(), db);
    expect(didDelete("movie_directors")).toBe(true);
    expect(didInsert("movie_directors")).toBe(true);
  });

  it("deletes directors but skips re-insert when no directors in crew", async () => {
    const { db, didInsert, didDelete } = makeDb();
    await updateMovieDetails(
      "27205",
      makeTMDBData({ credits: { cast: [], crew: [] } }),
      db,
    );
    expect(didDelete("movie_directors")).toBe(true);
    expect(didInsert("movie_directors")).toBe(false);
  });

  it("deletes and re-inserts actors", async () => {
    const { db, didInsert, didDelete } = makeDb();
    await updateMovieDetails("27205", makeTMDBData(), db);
    expect(didDelete("movie_actors")).toBe(true);
    expect(didInsert("movie_actors")).toBe(true);
  });

  it("deletes actors but skips re-insert when cast is empty", async () => {
    const { db, didInsert, didDelete } = makeDb();
    await updateMovieDetails(
      "27205",
      makeTMDBData({ credits: { cast: [], crew: [] } }),
      db,
    );
    expect(didDelete("movie_actors")).toBe(true);
    expect(didInsert("movie_actors")).toBe(false);
  });

  it("deletes and re-inserts production_companies", async () => {
    const { db, didInsert, didDelete } = makeDb();
    await updateMovieDetails("27205", makeTMDBData(), db);
    expect(didDelete("movie_production_companies")).toBe(true);
    expect(didInsert("movie_production_companies")).toBe(true);
  });

  it("deletes production_companies but skips re-insert when empty", async () => {
    const { db, didInsert, didDelete } = makeDb();
    await updateMovieDetails(
      "27205",
      makeTMDBData({ production_companies: [] }),
      db,
    );
    expect(didDelete("movie_production_companies")).toBe(true);
    expect(didInsert("movie_production_companies")).toBe(false);
  });

  it("deletes and re-inserts production_countries", async () => {
    const { db, didInsert, didDelete } = makeDb();
    await updateMovieDetails("27205", makeTMDBData(), db);
    expect(didDelete("movie_production_countries")).toBe(true);
    expect(didInsert("movie_production_countries")).toBe(true);
  });

  it("deletes production_countries but skips re-insert when empty", async () => {
    const { db, didInsert, didDelete } = makeDb();
    await updateMovieDetails(
      "27205",
      makeTMDBData({ production_countries: [] }),
      db,
    );
    expect(didDelete("movie_production_countries")).toBe(true);
    expect(didInsert("movie_production_countries")).toBe(false);
  });

  it("deduplicates production_companies by name", async () => {
    const { db, queries } = makeDb();
    const dupData = makeTMDBData({
      production_companies: [
        { id: 1, name: "WB", logo_path: "/wb1.png", origin_country: "US" },
        { id: 2, name: "WB", logo_path: "/wb2.png", origin_country: "US" }, // duplicate name
        {
          id: 3,
          name: "Universal",
          logo_path: "/uni.png",
          origin_country: "US",
        },
      ],
    });
    await updateMovieDetails("27205", dupData, db);

    const companiesInsert = queries.find((q) =>
      q.sql.includes(`insert into "movie_production_companies"`),
    );
    expect(companiesInsert).toBeDefined();
    // Two unique companies => "WB" is bound exactly once (not twice).
    expect(companiesInsert?.parameters.filter((p) => p === "WB")).toHaveLength(
      1,
    );
    expect(companiesInsert?.parameters).toContain("Universal");
  });
});
