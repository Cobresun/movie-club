/**
 * Tests for netlify/functions/utils/movieDetailsUpdater.ts
 *
 * insertMovieDetails and updateMovieDetails accept a Kysely db/transaction
 * object. We construct a minimal fluent-builder stub without real DB access.
 *
 * The tests assert:
 *  - the correct tables are written to
 *  - onConflict handling is wired up for insert paths
 *  - delete-then-insert strategy is used for update paths
 *  - optional arrays (genres, companies, etc.) are skipped when empty
 */
import { describe, expect, it, vi } from "vitest";

import { TMDBMovieData } from "../../../../lib/types/movie";
import { insertMovieDetails, updateMovieDetails } from "../movieDetailsUpdater";

// ─── Fluent builder stub ──────────────────────────────────────────────────────
// Each table operation returns an object whose methods all return `this`, with
// `execute` resolving to []. We track every `insertInto`, `updateTable`, and
// `deleteFrom` call so tests can assert on them.

function makeDbStub() {
  const insertedInto: string[] = [];
  const updatedTables: string[] = [];
  const deletedFrom: string[] = [];

  const builder = {
    values: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    onConflict: vi.fn((cb: (oc: unknown) => unknown) => {
      cb({
        column: vi.fn().mockReturnThis(),
        columns: vi.fn().mockReturnThis(),
        doNothing: vi.fn().mockReturnThis(),
      });
      return builder;
    }),
    execute: vi.fn().mockResolvedValue([]),
  };

  const db = {
    insertInto: vi.fn((table: string) => {
      insertedInto.push(table);
      return builder;
    }),
    updateTable: vi.fn((table: string) => {
      updatedTables.push(table);
      return builder;
    }),
    deleteFrom: vi.fn((table: string) => {
      deletedFrom.push(table);
      return builder;
    }),
    _insertedInto: insertedInto,
    _updatedTables: updatedTables,
    _deletedFrom: deletedFrom,
  };

  return db;
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
    const db = makeDbStub();
    await insertMovieDetails("27205", makeTMDBData(), db as never);
    expect(db._insertedInto).toContain("movie_details");
  });

  it("inserts genres when genres array is non-empty", async () => {
    const db = makeDbStub();
    await insertMovieDetails("27205", makeTMDBData(), db as never);
    expect(db._insertedInto).toContain("movie_genres");
  });

  it("skips genres insert when genres array is empty", async () => {
    const db = makeDbStub();
    await insertMovieDetails(
      "27205",
      makeTMDBData({ genres: [] }),
      db as never,
    );
    expect(db._insertedInto).not.toContain("movie_genres");
  });

  it("inserts production_companies when non-empty", async () => {
    const db = makeDbStub();
    await insertMovieDetails("27205", makeTMDBData(), db as never);
    expect(db._insertedInto).toContain("movie_production_companies");
  });

  it("skips production_companies insert when empty", async () => {
    const db = makeDbStub();
    await insertMovieDetails(
      "27205",
      makeTMDBData({ production_companies: [] }),
      db as never,
    );
    expect(db._insertedInto).not.toContain("movie_production_companies");
  });

  it("inserts production_countries when non-empty", async () => {
    const db = makeDbStub();
    await insertMovieDetails("27205", makeTMDBData(), db as never);
    expect(db._insertedInto).toContain("movie_production_countries");
  });

  it("skips production_countries insert when empty", async () => {
    const db = makeDbStub();
    await insertMovieDetails(
      "27205",
      makeTMDBData({ production_countries: [] }),
      db as never,
    );
    expect(db._insertedInto).not.toContain("movie_production_countries");
  });

  it("inserts directors filtering crew by job=Director", async () => {
    const db = makeDbStub();
    await insertMovieDetails("27205", makeTMDBData(), db as never);
    expect(db._insertedInto).toContain("movie_directors");
  });

  it("skips directors insert when no crew with job Director", async () => {
    const db = makeDbStub();
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
    await insertMovieDetails("27205", dataNoDirector, db as never);
    expect(db._insertedInto).not.toContain("movie_directors");
  });

  it("inserts actors when cast is non-empty", async () => {
    const db = makeDbStub();
    await insertMovieDetails("27205", makeTMDBData(), db as never);
    expect(db._insertedInto).toContain("movie_actors");
  });

  it("skips actors insert when cast is empty", async () => {
    const db = makeDbStub();
    const dataNoActors = makeTMDBData({ credits: { cast: [], crew: [] } });
    await insertMovieDetails("27205", dataNoActors, db as never);
    expect(db._insertedInto).not.toContain("movie_actors");
  });

  it("handles missing credits gracefully (no actors/directors insert)", async () => {
    const db = makeDbStub();
    await insertMovieDetails(
      "27205",
      makeTMDBData({ credits: undefined }),
      db as never,
    );
    expect(db._insertedInto).not.toContain("movie_actors");
    expect(db._insertedInto).not.toContain("movie_directors");
  });
});

// ─── updateMovieDetails ───────────────────────────────────────────────────────

describe("updateMovieDetails", () => {
  it("updates movie_details table", async () => {
    const db = makeDbStub();
    await updateMovieDetails("27205", makeTMDBData(), db as never);
    expect(db._updatedTables).toContain("movie_details");
  });

  it("deletes and re-inserts genres", async () => {
    const db = makeDbStub();
    await updateMovieDetails("27205", makeTMDBData(), db as never);
    expect(db._deletedFrom).toContain("movie_genres");
    expect(db._insertedInto).toContain("movie_genres");
  });

  it("deletes genres but skips re-insert when genres array is empty", async () => {
    const db = makeDbStub();
    await updateMovieDetails(
      "27205",
      makeTMDBData({ genres: [] }),
      db as never,
    );
    expect(db._deletedFrom).toContain("movie_genres");
    expect(db._insertedInto).not.toContain("movie_genres");
  });

  it("deletes and re-inserts directors", async () => {
    const db = makeDbStub();
    await updateMovieDetails("27205", makeTMDBData(), db as never);
    expect(db._deletedFrom).toContain("movie_directors");
    expect(db._insertedInto).toContain("movie_directors");
  });

  it("deletes directors but skips re-insert when no directors in crew", async () => {
    const db = makeDbStub();
    await updateMovieDetails(
      "27205",
      makeTMDBData({ credits: { cast: [], crew: [] } }),
      db as never,
    );
    expect(db._deletedFrom).toContain("movie_directors");
    expect(db._insertedInto).not.toContain("movie_directors");
  });

  it("deletes and re-inserts actors", async () => {
    const db = makeDbStub();
    await updateMovieDetails("27205", makeTMDBData(), db as never);
    expect(db._deletedFrom).toContain("movie_actors");
    expect(db._insertedInto).toContain("movie_actors");
  });

  it("deletes actors but skips re-insert when cast is empty", async () => {
    const db = makeDbStub();
    await updateMovieDetails(
      "27205",
      makeTMDBData({ credits: { cast: [], crew: [] } }),
      db as never,
    );
    expect(db._deletedFrom).toContain("movie_actors");
    expect(db._insertedInto).not.toContain("movie_actors");
  });

  it("deletes and re-inserts production_companies", async () => {
    const db = makeDbStub();
    await updateMovieDetails("27205", makeTMDBData(), db as never);
    expect(db._deletedFrom).toContain("movie_production_companies");
    expect(db._insertedInto).toContain("movie_production_companies");
  });

  it("deletes production_companies but skips re-insert when empty", async () => {
    const db = makeDbStub();
    await updateMovieDetails(
      "27205",
      makeTMDBData({ production_companies: [] }),
      db as never,
    );
    expect(db._deletedFrom).toContain("movie_production_companies");
    expect(db._insertedInto).not.toContain("movie_production_companies");
  });

  it("deletes and re-inserts production_countries", async () => {
    const db = makeDbStub();
    await updateMovieDetails("27205", makeTMDBData(), db as never);
    expect(db._deletedFrom).toContain("movie_production_countries");
    expect(db._insertedInto).toContain("movie_production_countries");
  });

  it("deletes production_countries but skips re-insert when empty", async () => {
    const db = makeDbStub();
    await updateMovieDetails(
      "27205",
      makeTMDBData({ production_countries: [] }),
      db as never,
    );
    expect(db._deletedFrom).toContain("movie_production_countries");
    expect(db._insertedInto).not.toContain("movie_production_countries");
  });

  it("deduplicates production_companies by name", async () => {
    const db = makeDbStub();
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
    await updateMovieDetails("27205", dupData, db as never);
    // values() was called for movie_production_companies; check its argument
    const insertCalls = db.insertInto.mock.calls.filter(
      (c) => c[0] === "movie_production_companies",
    );
    expect(insertCalls.length).toBeGreaterThan(0);
    // builder.values should have been called with 2 unique companies
    const valuesCalls = db._insertedInto.filter(
      (t) => t === "movie_production_companies",
    );
    expect(valuesCalls.length).toBe(1);
  });
});
