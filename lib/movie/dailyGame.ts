import { hasElements, hasValue, isDefined } from "../checks/checks.js";
import { type DailyGameRules, rarityPoints, type ScoredClue } from "../dailyGame.js";
import { type MovieDataSummary } from "../types/movie";
import { releaseYear } from "./releaseYear.js";

// A shared director is the strongest link two movies can have, a shared star
// half that. Studios, genres, language and decade are worth what their rarity
// says, capped so a tiny co-producer can't outweigh a star.
const DIRECTOR_POINTS = 10;
const STAR_POINTS = 5;
const MAX_STUDIO_POINTS = 5;
const MAX_GENRE_POINTS = 4;
const MAX_LANGUAGE_POINTS = 4;
const MAX_DECADE_POINTS = 3;

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

/**
 * `["1990"]` for a 1995 release. The decade is the era clue because the player
 * can check it at a glance: 1999 and 2001 are close, but share no clue.
 */
const decades = (movie: MovieDataSummary) => {
  const year = releaseYear(movie);
  return isDefined(year) ? [String(Math.floor(year / 10) * 10)] : [];
};

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

/**
 * Clues name major cast only: a full TMDB credit list runs to background
 * extras and stunt performers, who make no sense as "Also stars".
 */
export function makeMovieClues(pool: readonly MovieDataSummary[]) {
  const studioPoints = rarityPoints(pool, (movie) => movie.production_companies, MAX_STUDIO_POINTS);
  const genrePoints = rarityPoints(pool, (movie) => movie.genres, MAX_GENRE_POINTS);
  const languagePoints = rarityPoints(pool, languages, MAX_LANGUAGE_POINTS);
  const decadePoints = rarityPoints(pool, decades, MAX_DECADE_POINTS);

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
    ...sharedClues(
      decades(guess),
      decades(answer),
      decadePoints,
      (decade) => `Also from the ${decade}s`,
    ),
  ];
}

export const movieDailyGameRules: DailyGameRules<MovieDataSummary> = {
  makeClues: makeMovieClues,
  year: releaseYear,
  canBeAnswer: (movie) => hasElements(movie.directors),
};
