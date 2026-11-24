import { isDefined } from "../../../../lib/checks/checks.js";
import { type PoolWork, rankPool } from "../../../../lib/dailyGame.js";
import { type MovieGameData, movieDailyGameRules } from "../../../../lib/movie/dailyGame.js";
import { MAJOR_CAST_SIZE, STAR_POPULARITY } from "../../../../lib/movie/majorCast.js";
import { WorkType } from "../../../../lib/types/generated/db";
import { topWorkIds } from "../dailyGame";
import { db } from "../database";
import { collectionFromRow } from "../movieDetailsUpdater";
import { getTMDBMostRated } from "../tmdb";
import { type DailyGame } from "./types";

// 50 pages of 20: the 1000 most-rated. Any catalogued movie can be guessed,
// but the answer should be one most players have seen.
const ANSWER_PAGES = 50;

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
async function loadMovies(): Promise<PoolWork<MovieGameData>[]> {
  const [details, directors, cast, companies, genres] = await Promise.all([
    db
      .selectFrom("movie_details")
      .innerJoin(
        "daily_game_catalog",
        "daily_game_catalog.external_id",
        "movie_details.external_id",
      )
      .select([
        "movie_details.external_id",
        "daily_game_catalog.title",
        "movie_details.release_date",
        "movie_details.original_language",
        "movie_details.collection_id",
        "movie_details.collection_name",
      ])
      .where("daily_game_catalog.work_type", "=", WorkType.MOVIE)
      .where("movie_details.overview", "is not", null)
      .where("movie_details.overview", "!=", "")
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
      // thresholds are bound as strings too.
      .where((eb) =>
        eb.or([
          eb("cast_order", "<", String(MAJOR_CAST_SIZE)),
          eb("popularity", ">=", String(STAR_POPULARITY)),
        ]),
      )
      .orderBy("external_id")
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

  const directorsById = tagsByMovie(directors);
  const castById = tagsByMovie(cast);
  const companiesById = tagsByMovie(companies);
  const genresById = tagsByMovie(genres);

  return details.map((row) => ({
    id: row.external_id,
    title: row.title,
    data: {
      directors: (directorsById.get(row.external_id) ?? []).map((name) => ({ name })),
      majorCastNames: castById.get(row.external_id) ?? [],
      production_companies: companiesById.get(row.external_id) ?? [],
      genres: genresById.get(row.external_id) ?? [],
      release_date: row.release_date?.toISOString(),
      original_language: row.original_language ?? undefined,
      collection: collectionFromRow(row),
    },
  }));
}

const catalogPage: DailyGame["catalogPage"] = async (page) =>
  (await getTMDBMostRated(page)).results.map((movie) => ({
    externalId: String(movie.id),
    title: movie.title,
  }));

export const movieDailyGame: DailyGame = {
  // 150 pages of 20: the ~3000 most-rated movies, deep enough that most films a
  // player thinks to guess are in the pool.
  catalogPages: 150,
  catalogPage,
  loadPool: async () => {
    const movies = await loadMovies();
    return {
      size: movies.length,
      rank: (answerId) => rankPool(answerId, movies, movieDailyGameRules),
      answerCandidates: async () => {
        const top = await topWorkIds(catalogPage, ANSWER_PAGES);
        return movies
          .filter((movie) => top.has(movie.id) && movieDailyGameRules.canBeAnswer(movie.data))
          .map((movie) => movie.id);
      },
    };
  },
};
