import { hasElements, hasValue, isDefined } from "../checks/checks.js";
import { type DailyGameRules, rarityPoints, type ScoredClue, tagCounts } from "../dailyGame.js";
import { type MovieDataSummary } from "../types/movie";
import { releaseYear } from "./releaseYear.js";

// A shared director is the strongest link two movies can have, a TMDB
// collection (franchise) close behind, a shared star half a director. Genres, language and decade are worth what their rarity says. A
// shared genre is worth at least 2, so it always outweighs the 1 a guess loses
// for each genre the answer doesn't have.
const DIRECTOR_POINTS = 10;
const COLLECTION_POINTS = 8;
const STAR_POINTS = 5;
const STUDIO_POINTS = 2;
const GENRE_POINTS = { min: 2, max: 4 };
const LANGUAGE_POINTS = { min: 1, max: 4 };
const DECADE_POINTS = { min: 1, max: 3 };
const EXTRA_GENRE_POINTS = -1;

/**
 * A studio is a clue when it has a house style: enough films in the pool to
 * be one (not a co-financier on a handful), and few enough that sharing it
 * says something (not a major on a tenth of the pool).
 */
const MIN_STUDIO_WORKS = 5;
const MAX_STUDIO_SHARE = 0.03;

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
 * `1990` for a 1995 release. The decade is the era clue because the player
 * can check it at a glance: 1999 and 2001 are close, but share no clue.
 */
const decades = (movie: MovieDataSummary) => {
  const year = releaseYear(movie);
  return isDefined(year) ? [String(Math.floor(year / 10) * 10)] : [];
};

const shared = (guess: readonly string[], answer: readonly string[]) =>
  [...new Set(guess)].filter((tag) => answer.includes(tag));

function sharedClues(
  guess: readonly string[],
  answer: readonly string[],
  points: (tag: string) => number,
  text: (tag: string) => string,
): ScoredClue[] {
  return shared(guess, answer)
    .map((tag) => ({ text: text(tag), points: points(tag) }))
    .filter((clue) => clue.points > 0);
}

/** One chip for a whole field, so a row of shared stars or missing genres reads as one clue. */
function groupedClue(
  names: readonly string[],
  points: (count: number) => number,
  text: (names: readonly string[]) => string,
): ScoredClue[] {
  return hasElements(names) ? [{ text: text(names), points: points(names.length) }] : [];
}

const directorNames = (movie: MovieDataSummary) => movie.directors.map((d) => d.name);

function collectionClue(guess: MovieDataSummary, answer: MovieDataSummary): ScoredClue[] {
  const { collection } = guess;
  return isDefined(collection) && collection.id === answer.collection?.id
    ? [{ text: `Same series: ${collection.name}`, points: COLLECTION_POINTS }]
    : [];
}

/**
 * Clues name major cast only: a full TMDB credit list runs to background
 * extras and stunt performers, who make no sense as "Also stars".
 */
export function makeMovieClues(pool: readonly MovieDataSummary[]) {
  const studioCount = tagCounts(pool, (movie) => movie.production_companies);
  const studioPoints = (studio: string) => {
    const count = studioCount(studio);
    return count >= MIN_STUDIO_WORKS && count <= pool.length * MAX_STUDIO_SHARE ? STUDIO_POINTS : 0;
  };
  const genrePoints = rarityPoints(pool, (movie) => movie.genres, GENRE_POINTS);
  const languagePoints = rarityPoints(pool, languages, LANGUAGE_POINTS);
  const decadePoints = rarityPoints(pool, decades, DECADE_POINTS);

  return (guess: MovieDataSummary, answer: MovieDataSummary): ScoredClue[] => [
    ...collectionClue(guess, answer),
    // A directing team is one director's worth.
    ...groupedClue(
      shared(directorNames(guess), directorNames(answer)),
      () => DIRECTOR_POINTS,
      (names) => `Same director: ${names.join(" & ")}`,
    ),
    ...groupedClue(
      shared(guess.majorCastNames, answer.majorCastNames),
      (count) => count * STAR_POINTS,
      (names) => `Also stars ${names.join(", ")}`,
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
    // Each genre the guess has and the answer doesn't, so a guess with genres
    // to spare ranks below an exact match.
    ...groupedClue(
      [...new Set(guess.genres)].filter((genre) => !answer.genres.includes(genre)),
      (count) => count * EXTRA_GENRE_POINTS,
      (genres) => `Not ${genres.join(", ")}`,
    ),
  ];
}

export const movieDailyGameRules: DailyGameRules<MovieDataSummary> = {
  makeClues: makeMovieClues,
  year: releaseYear,
  canBeAnswer: (movie) => hasElements(movie.directors),
};
