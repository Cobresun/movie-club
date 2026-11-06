import { type PoolWork, rankPool } from "../../../../lib/dailyGame.js";
import { movieDailyGameRules } from "../../../../lib/movie/dailyGame.js";
import { type MovieDataSummary } from "../../../../lib/types/movie";
import { getTMDBMostRated } from "../tmdb";
import { type DailyGame, type DailyGamePoolEntry } from "./types";

const movies = (pool: readonly DailyGamePoolEntry[]): PoolWork<MovieDataSummary>[] =>
  pool.flatMap(({ externalId, title, data }) =>
    data.kind === "movie" ? [{ id: externalId, title, data }] : [],
  );

export const movieDailyGame: DailyGame = {
  // 150 pages of 20: the ~3000 most-rated movies, deep enough that most films a
  // player thinks to guess are in the pool.
  catalogPages: 150,
  catalogPage: async (page) =>
    (await getTMDBMostRated(page)).results.map((movie) => ({
      externalId: String(movie.id),
      title: movie.title,
    })),
  rank: (answerId, pool) => rankPool(answerId, movies(pool), movieDailyGameRules),
  answerCandidates: (pool) =>
    movies(pool)
      .filter((movie) => movieDailyGameRules.canBeAnswer(movie.data))
      .map((movie) => movie.id),
};
