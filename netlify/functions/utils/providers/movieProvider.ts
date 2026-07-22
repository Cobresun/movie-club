import { sql } from "kysely";
import { jsonBuildObject } from "kysely/helpers/postgres";

import { isDefined, hasValue } from "../../../../lib/checks/checks.js";
import { MAJOR_CAST_SIZE, STAR_POPULARITY } from "../../../../lib/movie/majorCast.js";
import { WorkType } from "../../../../lib/types/generated/db";
import { DetailedWorkData, WorkDataSummary } from "../../../../lib/types/lists";
import { MovieCastMember, MovieDataSummary } from "../../../../lib/types/movie";
import { db } from "../database";
import { insertMovieDetails, updateMovieDetails } from "../movieDetailsUpdater";
import { getTMDBMovieData } from "../tmdb";
import { MediaProvider, RefreshResult } from "./types";

/**
 * Builds the `movie_details` + junction aggregates for a set of external IDs,
 * excluding the cast (see {@link castQuery}). Cast lists dominate row size, so
 * keeping them out of this query keeps bulk list/review responses small and
 * avoids shipping megabytes from the database on every list load.
 */
function summaryQuery(externalIds: string[]) {
  return db
    .with("genres_agg", (qb) =>
      qb
        .selectFrom("movie_genres")
        .select(["external_id", db.fn.agg<string[]>("array_agg", ["genre_name"]).as("genres")])
        .groupBy("external_id"),
    )
    .with("companies_agg", (qb) =>
      qb
        .selectFrom("movie_production_companies")
        .select([
          "external_id",
          db.fn.agg<string[]>("array_agg", ["company_name"]).as("production_companies"),
        ])
        .groupBy("external_id"),
    )
    .with("countries_agg", (qb) =>
      qb
        .selectFrom("movie_production_countries")
        .select([
          "external_id",
          db.fn.agg<string[]>("array_agg", ["country_name"]).as("production_countries"),
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
    .with("cast_names_agg", (qb) =>
      qb
        .selectFrom("movie_actors")
        .select([
          "external_id",
          sql<string[]>`array_agg(actor_name ORDER BY cast_order)`.as("cast_names"),
          // Major cast only (top-billed OR a popularity star), filtered in the
          // DB so the payload still ships names only — see lib/movie/majorCast.
          sql<
            string[]
          >`array_agg(actor_name ORDER BY cast_order) FILTER (WHERE cast_order < ${MAJOR_CAST_SIZE} OR popularity >= ${STAR_POPULARITY})`.as(
            "major_cast_names",
          ),
        ])
        .groupBy("external_id"),
    )
    .selectFrom("movie_details")
    .where("movie_details.external_id", "in", externalIds)
    .leftJoin("genres_agg", "genres_agg.external_id", "movie_details.external_id")
    .leftJoin("companies_agg", "companies_agg.external_id", "movie_details.external_id")
    .leftJoin("countries_agg", "countries_agg.external_id", "movie_details.external_id")
    .leftJoin("directors_agg", "directors_agg.external_id", "movie_details.external_id")
    .leftJoin("cast_names_agg", "cast_names_agg.external_id", "movie_details.external_id")
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
      "cast_names_agg.cast_names",
      "cast_names_agg.major_cast_names",
    ]);
}

type MovieSummaryRow = Awaited<ReturnType<ReturnType<typeof summaryQuery>["execute"]>>[number];

/** Coerce a nullable Int8/decimal column (string | null) to number | undefined. */
function num(value: string | null): number | undefined {
  return isDefined(value) ? Number(value) : undefined;
}

function toMovieDataSummary(row: MovieSummaryRow): MovieDataSummary {
  return {
    kind: "movie",
    castNames: row.cast_names?.filter(Boolean) ?? [],
    majorCastNames: row.major_cast_names?.filter(Boolean) ?? [],
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
    // Details are immutable enough that a cached row means the TMDB round
    // trip can be skipped entirely — the scheduled refresh keeps rows fresh.
    // This makes re-adding a known movie (the common case) a single query.
    const cached = await db
      .selectFrom("movie_details")
      .select("external_id")
      .where("external_id", "=", externalId)
      .executeTakeFirst();
    if (isDefined(cached)) return;

    const { data } = await getTMDBMovieData(parseInt(externalId));
    await insertMovieDetails(externalId, data, db);
  }

  async getExternalData(externalIds: string[]): Promise<Map<string, DetailedWorkData>> {
    const map = new Map<string, DetailedWorkData>();
    if (externalIds.length === 0) return map;

    const [summaries, casts] = await Promise.all([
      this.getExternalDataSummary(externalIds),
      this.getCast(externalIds),
    ]);
    for (const [externalId, summary] of summaries) {
      if (summary.kind !== "movie") continue;
      map.set(externalId, {
        ...summary,
        actors: casts.get(externalId) ?? [],
      });
    }
    return map;
  }

  async getExternalDataSummary(externalIds: string[]): Promise<Map<string, WorkDataSummary>> {
    const map = new Map<string, WorkDataSummary>();
    if (externalIds.length === 0) return map;

    const rows = await summaryQuery(externalIds).execute();
    for (const row of rows) {
      if (hasValue(row.external_id) && hasValue(row.overview)) {
        map.set(row.external_id, toMovieDataSummary(row));
      }
    }
    return map;
  }

  async getCast(externalIds: string[]): Promise<Map<string, MovieCastMember[]>> {
    const map = new Map<string, MovieCastMember[]>();
    if (externalIds.length === 0) return map;

    const rows = await db
      .selectFrom("movie_actors")
      .where("external_id", "in", externalIds)
      .select(["external_id", "actor_name", "character_name", "profile_path"])
      .orderBy("external_id")
      .orderBy("cast_order")
      .execute();
    for (const row of rows) {
      const cast = map.get(row.external_id) ?? [];
      cast.push({
        name: row.actor_name,
        character: row.character_name,
        profilePath: row.profile_path,
      });
      map.set(row.external_id, cast);
    }
    return map;
  }

  async getDiscussionPrompt(work: { title: string; externalId: string | null }): Promise<string> {
    let releaseYear: string | undefined;
    if (hasValue(work.externalId)) {
      const details = await db
        .selectFrom("movie_details")
        .where("external_id", "=", work.externalId)
        .select("release_date")
        .executeTakeFirst();
      releaseYear = details?.release_date?.getFullYear().toString();
    }
    const label = hasValue(releaseYear) ? `${work.title} (${releaseYear})` : work.title;
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
        await db.transaction().execute((trx) => updateMovieDetails(external_id, data, trx));
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
