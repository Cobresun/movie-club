import { hasValue } from "../../../../lib/checks/checks.js";
import { type PoolWork, rankPool } from "../../../../lib/dailyGame.js";
import { movieDailyGameRules } from "../../../../lib/movie/dailyGame.js";
import { type MovieDataSummary } from "../../../../lib/types/movie";
import { topWorkIds } from "../dailyGame";
import { getTMDBMostRated } from "../tmdb";
import { type DailyGame, type DailyGamePoolEntry } from "./types";

// 50 pages of 20: the 1000 most-rated. Any catalogued movie can be guessed,
// but the answer should be one most players have seen.
const ANSWER_PAGES = 50;

const TMDB_POSTER_BASE = "https://image.tmdb.org/t/p/w342";

const movies = (pool: readonly DailyGamePoolEntry[]): PoolWork<MovieDataSummary>[] =>
  pool.flatMap(({ externalId, title, data }) =>
    data.kind === "movie" ? [{ id: externalId, title, data }] : [],
  );

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
  rank: (answerId, pool) => rankPool(answerId, movies(pool), movieDailyGameRules),
  answerCandidates: async (pool) => {
    const top = await topWorkIds(catalogPage, ANSWER_PAGES);
    return movies(pool)
      .filter((movie) => top.has(movie.id) && movieDailyGameRules.canBeAnswer(movie.data))
      .map((movie) => movie.id);
  },
  imageUrl: (answerId, pool) => {
    const posterPath = movies(pool).find((movie) => movie.id === answerId)?.data.poster_path;
    return hasValue(posterPath) ? `${TMDB_POSTER_BASE}${posterPath}` : undefined;
  },
};
