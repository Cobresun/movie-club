import { z } from "zod";

import { hasElements } from "./checks/checks.js";
import { releaseYear } from "./movie/releaseYear.js";
import { makeMovieScorer } from "./movie/similarity.js";
import { DailyGameMovie } from "./types/dailyGame";
import { MovieDataSummary } from "./types/movie";

export interface PoolMovie {
  id: string;
  title: string;
  data: MovieDataSummary;
}

/** Shared tags past this many read as a list rather than a clue. */
const CLUES_PER_FIELD = 3;

const shared = (a: readonly string[], b: readonly string[]) =>
  a.filter((value) => b.includes(value)).slice(0, CLUES_PER_FIELD);

const decade = (year: number) => Math.floor(year / 10) * 10;

/** What `guess` has in common with `answer`, phrased for the player. */
export function clues(guess: MovieDataSummary, answer: MovieDataSummary): string[] {
  const guessYear = releaseYear(guess);
  const answerYear = releaseYear(answer);
  const sameDecade =
    guessYear !== undefined && answerYear !== undefined && decade(guessYear) === decade(answerYear);
  return [
    ...shared(
      guess.directors.map((d) => d.name),
      answer.directors.map((d) => d.name),
    ).map((name) => `Same director: ${name}`),
    ...shared(guess.castNames, answer.castNames).map((name) => `Also stars ${name}`),
    ...shared(guess.production_companies, answer.production_companies).map(
      (company) => `Same studio: ${company}`,
    ),
    ...shared(guess.genres, answer.genres),
    ...(sameDecade ? [`Also from the ${decade(guessYear)}s`] : []),
  ];
}

/**
 * Every movie in the pool, ranked by how alike it is to the answer — the same
 * scorer Score Assist uses, with the pool as its corpus. The answer is rank 1;
 * ties keep a stable order by title.
 */
export function rankPool(answerId: string, pool: readonly PoolMovie[]): DailyGameMovie[] {
  const answer = pool.find((movie) => movie.id === answerId);
  if (answer === undefined) return [];
  const score = makeMovieScorer(pool.map((movie) => movie.data));
  const others = pool
    .filter((movie) => movie.id !== answerId)
    .map((movie) => ({ movie, score: score(answer.data, movie.data) }))
    .sort((a, b) =>
      a.score === b.score ? a.movie.title.localeCompare(b.movie.title) : b.score - a.score,
    );
  return [answer, ...others.map(({ movie }) => movie)].map((movie, index) => ({
    id: movie.id,
    title: movie.title,
    year: releaseYear(movie.data),
    rank: index + 1,
    clues: movie.id === answerId ? [] : clues(movie.data, answer.data),
  }));
}

/**
 * Whether a movie can be an answer: one with a director to clue towards, so
 * the trail never runs cold on metadata TMDB didn't have.
 */
export const canBeAnswer = (movie: PoolMovie) => hasElements(movie.data.directors);

/**
 * The next answer: a random movie that has never been one, or the movie whose
 * last turn was longest ago once every movie has had one. `pastAnswers` is
 * oldest first.
 */
export function pickAnswer(
  candidates: readonly string[],
  pastAnswers: readonly string[],
  random: () => number = Math.random,
): string | undefined {
  const used = new Set(pastAnswers);
  const fresh = candidates.filter((id) => !used.has(id));
  if (hasElements(fresh)) return fresh[Math.floor(random() * fresh.length)];
  const lastTurn = new Map(pastAnswers.map((id, index) => [id, index]));
  return [...candidates].sort((a, b) => (lastTurn.get(a) ?? 0) - (lastTurn.get(b) ?? 0))[0];
}

export const puzzleDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), "Not a calendar date");

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Players ask for their own local date, and time zones run from UTC−12 to
 * UTC+14, so a date within a day of the server's UTC date is somebody's today.
 * Anything further out would let a player read ahead.
 */
export function isSomebodysToday(date: string, now: Date): boolean {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.abs(Date.parse(`${date}T00:00:00Z`) - today) <= DAY_MS;
}
