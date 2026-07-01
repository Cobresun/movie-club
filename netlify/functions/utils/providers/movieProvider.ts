import { sql } from "kysely";

import { isDefined, hasValue } from "../../../../lib/checks/checks.js";
import { WorkType } from "../../../../lib/types/generated/db";
import { DetailedWorkData } from "../../../../lib/types/lists";
import { DetailedMovieData } from "../../../../lib/types/movie";
import { db } from "../database";
import { insertMovieDetails, updateMovieDetails } from "../movieDetailsUpdater";
import { getTMDBMovieData } from "../tmdb";
import { MediaProvider, RefreshResult } from "./types";

/**
 * Builds the `movie_details` + junction aggregates for a set of external IDs.
 * This is the query that used to live inline in ListRepository /
 * ReviewRepository; it now belongs to the movie provider.
 */
function detailsQuery(externalIds: string[]) {
  return db
    .with("genres_agg", (qb) =>
      qb
        .selectFrom("movie_genres")
        .select([
          "external_id",
          db.fn.agg<string[]>("array_agg", ["genre_name"]).as("genres"),
        ])
        .groupBy("external_id"),
    )
    .with("companies_agg", (qb) =>
      qb
        .selectFrom("movie_production_companies")
        .select([
          "external_id",
          db.fn
            .agg<string[]>("array_agg", ["company_name"])
            .as("production_companies"),
        ])
        .groupBy("external_id"),
    )
    .with("countries_agg", (qb) =>
      qb
        .selectFrom("movie_production_countries")
        .select([
          "external_id",
          db.fn
            .agg<string[]>("array_agg", ["country_name"])
            .as("production_countries"),
        ])
        .groupBy("external_id"),
    )
    .with("directors_agg", (qb) =>
      qb
        .selectFrom("movie_directors")
        .select([
          "external_id",
          sql<
            { name: string; profilePath: string | null }[]
          >`json_agg(json_build_object('name', director_name, 'profilePath', profile_path))`.as(
            "directors",
          ),
        ])
        .groupBy("external_id"),
    )
    .with("actors_agg", (qb) =>
      qb
        .selectFrom("movie_actors")
        .select([
          "external_id",
          sql<
            { name: string; profilePath: string | null }[]
          >`json_agg(json_build_object('name', actor_name, 'profilePath', profile_path) ORDER BY cast_order)`.as(
            "actors",
          ),
        ])
        .groupBy("external_id"),
    )
    .selectFrom("movie_details")
    .where("movie_details.external_id", "in", externalIds)
    .leftJoin(
      "genres_agg",
      "genres_agg.external_id",
      "movie_details.external_id",
    )
    .leftJoin(
      "companies_agg",
      "companies_agg.external_id",
      "movie_details.external_id",
    )
    .leftJoin(
      "countries_agg",
      "countries_agg.external_id",
      "movie_details.external_id",
    )
    .leftJoin(
      "directors_agg",
      "directors_agg.external_id",
      "movie_details.external_id",
    )
    .leftJoin(
      "actors_agg",
      "actors_agg.external_id",
      "movie_details.external_id",
    )
    .select([
      "movie_details.external_id",
      "movie_details.tmdb_score",
      "movie_details.runtime",
      "movie_details.budget",
      "movie_details.revenue",
      "movie_details.release_date",
      "movie_details.adult",
      "movie_details.backdrop_path",
      "movie_details.homepage",
      "movie_details.imdb_id",
      "movie_details.original_language",
      "movie_details.original_title",
      "movie_details.overview",
      "movie_details.popularity",
      "movie_details.poster_path",
      "movie_details.status",
      "movie_details.tagline",
      "genres_agg.genres",
      "companies_agg.production_companies",
      "countries_agg.production_countries",
      "directors_agg.directors",
      "actors_agg.actors",
    ]);
}

type MovieDetailRow = Awaited<
  ReturnType<ReturnType<typeof detailsQuery>["execute"]>
>[number];

/** Coerce a nullable Int8/decimal column (string | null) to number | undefined. */
function num(value: string | null): number | undefined {
  return isDefined(value) ? Number(value) : undefined;
}

/**
 * Maps a raw `movie_details` aggregate row to the public {@link DetailedMovieData}
 * shape: nullable Int8/decimal columns become `number | undefined`, dates become
 * ISO strings, and aggregate arrays default to `[]`. Exported for unit testing.
 */
export function toDetailedMovieData(row: MovieDetailRow): DetailedMovieData {
  return {
    kind: "movie",
    actors: row.actors?.filter(isDefined) ?? [],
    directors: row.directors?.filter(isDefined) ?? [],
    genres: row.genres?.filter(Boolean) ?? [],
    production_companies: row.production_companies?.filter(Boolean) ?? [],
    production_countries: row.production_countries?.filter(Boolean) ?? [],
    adult: row.adult ?? undefined,
    backdrop_path: row.backdrop_path ?? undefined,
    budget: num(row.budget),
    homepage: row.homepage ?? undefined,
    imdb_id: row.imdb_id ?? undefined,
    original_language: row.original_language ?? undefined,
    original_title: row.original_title ?? undefined,
    overview: row.overview ?? undefined,
    popularity: num(row.popularity),
    poster_path: row.poster_path ?? undefined,
    release_date: row.release_date?.toISOString(),
    revenue: num(row.revenue),
    runtime: num(row.runtime),
    status: row.status ?? undefined,
    tagline: row.tagline ?? undefined,
    vote_average: num(row.tmdb_score),
  };
}

class MovieProvider implements MediaProvider {
  readonly type = WorkType.movie;

  async fetchAndCacheDetails(externalId: string): Promise<void> {
    const { data } = await getTMDBMovieData(parseInt(externalId));
    await insertMovieDetails(externalId, data, db);
  }

  async getExternalData(
    externalIds: string[],
  ): Promise<Map<string, DetailedWorkData>> {
    const map = new Map<string, DetailedWorkData>();
    if (externalIds.length === 0) return map;

    const rows = await detailsQuery(externalIds).execute();
    for (const row of rows) {
      if (hasValue(row.external_id) && hasValue(row.overview)) {
        map.set(row.external_id, toDetailedMovieData(row));
      }
    }
    return map;
  }

  async refreshStaleDetails(limit: number): Promise<RefreshResult> {
    const stale = await db
      .selectFrom("movie_details")
      .select("external_id")
      .orderBy("updated_date", "asc")
      .limit(limit)
      .execute();

    const result: RefreshResult = { processed: 0, updated: 0, errors: [] };
    for (const { external_id } of stale) {
      result.processed++;
      try {
        const { data } = await getTMDBMovieData(parseInt(external_id));
        await db
          .transaction()
          .execute((trx) => updateMovieDetails(external_id, data, trx));
        result.updated++;
      } catch (error) {
        result.errors.push({
          externalId: external_id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
    return result;
  }
}

export default new MovieProvider();
