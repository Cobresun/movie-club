import { hasElements } from "../checks/checks.js";
import { type DailyGameRules } from "../dailyGame.js";
import { type MovieDataSummary } from "../types/movie";
import { releaseYear } from "./releaseYear.js";
import { makeMovieScorer } from "./similarity.js";

/** Shared tags past this many read as a list rather than a clue. */
const CLUES_PER_FIELD = 3;

const shared = (a: readonly string[], b: readonly string[]) =>
  a.filter((value) => b.includes(value)).slice(0, CLUES_PER_FIELD);

const decade = (year: number) => Math.floor(year / 10) * 10;

/**
 * Clues name major cast only: a full TMDB credit list runs to background
 * extras and stunt performers, who make no sense as "Also stars".
 */
export function movieClues(guess: MovieDataSummary, answer: MovieDataSummary): string[] {
  const guessYear = releaseYear(guess);
  const answerYear = releaseYear(answer);
  const sameDecade =
    guessYear !== undefined && answerYear !== undefined && decade(guessYear) === decade(answerYear);
  return [
    ...shared(
      guess.directors.map((d) => d.name),
      answer.directors.map((d) => d.name),
    ).map((name) => `Same director: ${name}`),
    ...shared(guess.majorCastNames, answer.majorCastNames).map((name) => `Also stars ${name}`),
    ...shared(guess.production_companies, answer.production_companies).map(
      (company) => `Same studio: ${company}`,
    ),
    ...shared(guess.genres, answer.genres),
    ...(sameDecade ? [`Also from the ${decade(guessYear)}s`] : []),
  ];
}

/** The movie game ranks with the same scorer as Score Assist. */
export const movieDailyGameRules: DailyGameRules<MovieDataSummary> = {
  makeScorer: makeMovieScorer,
  clues: movieClues,
  year: releaseYear,
  canBeAnswer: (movie) => hasElements(movie.directors),
};
