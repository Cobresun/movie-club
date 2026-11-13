import { sql, type SqlBool } from "kysely";

import { isDefined } from "../../../../lib/checks/checks.js";
import { type PoolWork, rankPool } from "../../../../lib/dailyGame.js";
import { movieDailyGameRules } from "../../../../lib/movie/dailyGame.js";
import { MAJOR_CAST_SIZE, STAR_POPULARITY } from "../../../../lib/movie/majorCast.js";
import { type MovieSimilarityData } from "../../../../lib/movie/similarity.js";
import { WorkType } from "../../../../lib/types/generated/db";
import { db } from "../database";
import { getTMDBMostRated } from "../tmdb";
import { type CatalogCandidate, type DailyGame } from "./types";

const catalogued = () =>
  db.selectFrom("daily_game_catalog").select("external_id").where("work_type", "=", WorkType.MOVIE);

const tagsByMovie = (rows: readonly { external_id: string; tag: string }[]) => {
  const tags = new Map<string, string[]>();
  for (const { external_id, tag } of rows) {
    const movie = tags.get(external_id);
    if (isDefined(movie)) movie.push(tag);
    else tags.set(external_id, [tag]);
  }
  return tags;
};

/**
 * The catalog's movies with what the game compares them on. A movie without
 * an overview has no cached details worth ranking and is left out, as it is
 * from every list.
 */
async function loadMovies(
  catalog: readonly CatalogCandidate[],
): Promise<PoolWork<MovieSimilarityData>[]> {
  const [details, directors, cast, companies, genres] = await Promise.all([
    db
      .selectFrom("movie_details")
      .select(["external_id", "release_date", "original_language"])
      .where("external_id", "in", catalogued())
      .where("overview", "is not", null)
      .where("overview", "!=", "")
      .execute(),
    db
      .selectFrom("movie_directors")
      .select(["external_id", "director_name as tag"])
      .where("external_id", "in", catalogued())
      .execute(),
    db
      .selectFrom("movie_actors")
      .select(["external_id", "actor_name as tag"])
      .where("external_id", "in", catalogued())
      // cast_order (Int8) and popularity (Numeric) select as strings, so the
      // thresholds are bound as params against type-checked column refs.
      .where((eb) =>
        eb.or([
          sql<SqlBool>`${eb.ref("cast_order")} < ${MAJOR_CAST_SIZE}`,
          sql<SqlBool>`${eb.ref("popularity")} >= ${STAR_POPULARITY}`,
        ]),
      )
      .orderBy("cast_order")
      .execute(),
    db
      .selectFrom("movie_production_companies")
      .select(["external_id", "company_name as tag"])
      .where("external_id", "in", catalogued())
      .execute(),
    db
      .selectFrom("movie_genres")
      .select(["external_id", "genre_name as tag"])
      .where("external_id", "in", catalogued())
      .execute(),
  ]);

  const detailsById = new Map(details.map((row) => [row.external_id, row]));
  const directorsById = tagsByMovie(directors);
  const castById = tagsByMovie(cast);
  const companiesById = tagsByMovie(companies);
  const genresById = tagsByMovie(genres);

  return catalog.flatMap(({ externalId, title }) => {
    const row = detailsById.get(externalId);
    if (!isDefined(row)) return [];
    return [
      {
        id: externalId,
        title,
        data: {
          directors: (directorsById.get(externalId) ?? []).map((name) => ({ name })),
          majorCastNames: castById.get(externalId) ?? [],
          production_companies: companiesById.get(externalId) ?? [],
          genres: genresById.get(externalId) ?? [],
          release_date: row.release_date?.toISOString(),
          original_language: row.original_language ?? undefined,
        },
      },
    ];
  });
}

export const movieDailyGame: DailyGame = {
  // 150 pages of 20: the ~3000 most-rated movies, deep enough that most films a
  // player thinks to guess are in the pool.
  catalogPages: 150,
  catalogPage: async (page) =>
    (await getTMDBMostRated(page)).results.map((movie) => ({
      externalId: String(movie.id),
      title: movie.title,
    })),
  loadPool: async (catalog) => {
    const movies = await loadMovies(catalog);
    return {
      size: movies.length,
      rank: (answerId) => rankPool(answerId, movies, movieDailyGameRules),
      answerCandidates: () =>
        movies
          .filter((movie) => movieDailyGameRules.canBeAnswer(movie.data))
          .map((movie) => movie.id),
    };
  },
};
