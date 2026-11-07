import { hasElements, hasValue, isDefined } from "../checks/checks.js";
import { type DailyGameRules, rarityPoints, type ScoredClue } from "../dailyGame.js";
import { type MovieDataSummary } from "../types/movie";
import { releaseYear } from "./releaseYear.js";

// A shared director is the strongest link two movies can have, a shared star
// half that. Studios, genres and language are worth what their rarity says,
// capped so a tiny co-producer can't outweigh a star.
const DIRECTOR_POINTS = 10;
const STAR_POINTS = 5;
const MAX_STUDIO_POINTS = 5;
const MAX_GENRE_POINTS = 4;
const MAX_LANGUAGE_POINTS = 4;

/** Release-year closeness, nearest first; a gap past the last counts for nothing. */
const ERA_TIERS = [
  { within: 0, points: 3, text: "Released the same year" },
  { within: 3, points: 2, text: "Released within 3 years" },
  { within: 10, points: 1, text: "Released within 10 years" },
] as const;

/** Shared tags past this many read as a list rather than a clue, so they don't score either. */
const CLUES_PER_FIELD = 3;

const languageNames = new Intl.DisplayNames(["en"], { type: "language", fallback: "none" });

/** `ko` → `Korean`; undefined for a code with no name, such as TMDB's `xx`. */
function languageName(code: string): string | undefined {
  try {
    return languageNames.of(code);
  } catch {
    return undefined;
  }
}

const languages = (movie: MovieDataSummary) =>
  hasValue(movie.original_language) ? [movie.original_language] : [];

function sharedClues(
  guess: readonly string[],
  answer: readonly string[],
  points: (tag: string) => number,
  text: (tag: string) => string,
): ScoredClue[] {
  return [...new Set(guess)]
    .filter((tag) => answer.includes(tag))
    .map((tag) => ({ text: text(tag), points: points(tag) }))
    .filter((clue) => clue.points > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, CLUES_PER_FIELD);
}

function eraClue(guess: MovieDataSummary, answer: MovieDataSummary): ScoredClue[] {
  const guessYear = releaseYear(guess);
  const answerYear = releaseYear(answer);
  if (!isDefined(guessYear) || !isDefined(answerYear)) return [];
  const gap = Math.abs(guessYear - answerYear);
  const tier = ERA_TIERS.find((candidate) => gap <= candidate.within);
  return isDefined(tier) ? [{ text: tier.text, points: tier.points }] : [];
}

/**
 * Clues name major cast only: a full TMDB credit list runs to background
 * extras and stunt performers, who make no sense as "Also stars".
 */
export function makeMovieClues(pool: readonly MovieDataSummary[]) {
  const studioPoints = rarityPoints(pool, (movie) => movie.production_companies, MAX_STUDIO_POINTS);
  const genrePoints = rarityPoints(pool, (movie) => movie.genres, MAX_GENRE_POINTS);
  const languagePoints = rarityPoints(pool, languages, MAX_LANGUAGE_POINTS);

  return (guess: MovieDataSummary, answer: MovieDataSummary): ScoredClue[] => [
    ...sharedClues(
      guess.directors.map((d) => d.name),
      answer.directors.map((d) => d.name),
      () => DIRECTOR_POINTS,
      (name) => `Same director: ${name}`,
    ),
    ...sharedClues(
      guess.majorCastNames,
      answer.majorCastNames,
      () => STAR_POINTS,
      (name) => `Also stars ${name}`,
    ),
    ...sharedClues(
      guess.production_companies,
      answer.production_companies,
      studioPoints,
      (company) => `Same studio: ${company}`,
    ),
    ...sharedClues(guess.genres, answer.genres, genrePoints, (genre) => genre),
    ...sharedClues(
      languages(guess).filter((code) => isDefined(languageName(code))),
      languages(answer),
      languagePoints,
      (code) => `Also in ${languageName(code) ?? code}`,
    ),
    ...eraClue(guess, answer),
  ];
}

export const movieDailyGameRules: DailyGameRules<MovieDataSummary> = {
  makeClues: makeMovieClues,
  year: releaseYear,
  canBeAnswer: (movie) => hasElements(movie.directors),
};
