import { jsonBuildObject } from "kysely/helpers/postgres";

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
        .select((eb) => [
          "external_id",
          eb.fn
            .jsonAgg(
              jsonBuildObject({
                name: eb.ref("director_name"),
                profilePath: eb.ref("profile_path"),
              }),
            )
            .as("directors"),
        ])
        .groupBy("external_id"),
    )
    .with("actors_agg", (qb) =>
      qb
        .selectFrom("movie_actors")
        .select((eb) => [
          "external_id",
          eb.fn
            .jsonAgg(
              jsonBuildObject({
                name: eb.ref("actor_name"),
                character: eb.ref("character_name"),
                profilePath: eb.ref("profile_path"),
              }),
            )
            .orderBy("cast_order")
            .as("actors"),
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

function toDetailedMovieData(row: MovieDetailRow): DetailedMovieData {
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

  async getDiscussionPrompt(work: {
    title: string;
    externalId: string | null;
  }): Promise<string> {
    let releaseYear: string | undefined;
    if (hasValue(work.externalId)) {
      const details = await db
        .selectFrom("movie_details")
        .where("external_id", "=", work.externalId)
        .select("release_date")
        .executeTakeFirst();
      releaseYear = details?.release_date?.getFullYear().toString();
    }
    const label = hasValue(releaseYear)
      ? `${work.title} (${releaseYear})`
      : work.title;
    return `Generate 3 to 5 discussion prompts for a movie club rewatching "${label}". Every prompt must be specific to THIS film — naming its actual characters, scenes, lines, or moments — never a generic question that could apply to any movie.

Order the prompts by depth: the first should be casual and easy to answer — a low-stakes entry point. Each subsequent prompt should be more thought-provoking than the last, with the final one being substantial — a real book-club-worthy question, adapted for film.

Whenever the film supports it, frame prompts as debates: questions with defensible answers on more than one side, designed to spark disagreement among friends rather than consensus. Keep each prompt succinct — one clear, concise question with no preamble.

If you do not recognize this film or cannot confirm it is a real movie, return 0 questions.`;
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
