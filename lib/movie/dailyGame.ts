import { hasElements, hasValue, isDefined } from "../checks/checks.js";
import {
  type DailyGameRules,
  decadeTags,
  groupedClue,
  languageName,
  rarityPoints,
  type ScoredClue,
  sharedClues,
  sharedTags,
  tagCounts,
} from "../dailyGame.js";
import { releaseYear } from "./releaseYear.js";

/** What the game ranks and clues movies by: the only metadata it reads. */
export interface MovieGameData {
  directors: readonly { name: string }[];
  majorCastNames: readonly string[];
  production_companies: readonly string[];
  genres: readonly string[];
  release_date?: string;
  original_language?: string;
}

// A shared director is the strongest link two movies can have, a shared star
// half that. Genres, language and decade are worth what their rarity says.
// A genre the answer doesn't have shows as a miss, so a shared one always
// shows, however common.
const DIRECTOR_POINTS = 10;
const STAR_POINTS = 5;
const STUDIO_POINTS = 2;
const GENRE_POINTS = { min: 1, max: 4, dropMajority: false };
const LANGUAGE_POINTS = { min: 1, max: 4, dropMajority: true };
const DECADE_POINTS = { min: 1, max: 3, dropMajority: true };
const EXTRA_GENRE_POINTS = -1;

/**
 * A studio is a clue when it has a house style: enough films in the pool to
 * be one (not a co-financier on a handful), and few enough that sharing it
 * says something (not a major on a tenth of the pool).
 */
const MIN_STUDIO_WORKS = 5;
const MAX_STUDIO_SHARE = 0.03;

const languages = (movie: MovieGameData) =>
  hasValue(movie.original_language) ? [movie.original_language] : [];

const decades = (movie: MovieGameData) => decadeTags(releaseYear(movie));

const directorNames = (movie: MovieGameData) => movie.directors.map((d) => d.name);

/**
 * Clues name major cast only: a full TMDB credit list runs to background
 * extras and stunt performers, who make no sense as "Also stars".
 */
export function makeMovieClues(pool: readonly MovieGameData[]) {
  const studioCount = tagCounts(pool, (movie) => movie.production_companies);
  const studioPoints = (studio: string) => {
    const count = studioCount(studio);
    return count >= MIN_STUDIO_WORKS && count <= pool.length * MAX_STUDIO_SHARE ? STUDIO_POINTS : 0;
  };
  const genrePoints = rarityPoints(pool, (movie) => movie.genres, GENRE_POINTS);
  const languagePoints = rarityPoints(pool, languages, LANGUAGE_POINTS);
  const decadePoints = rarityPoints(pool, decades, DECADE_POINTS);

  return (guess: MovieGameData, answer: MovieGameData): ScoredClue[] => [
    // A directing team is one director's worth.
    ...groupedClue(
      sharedTags(directorNames(guess), directorNames(answer)),
      () => DIRECTOR_POINTS,
      (names) => `Same director: ${names.join(" & ")}`,
    ),
    ...groupedClue(
      sharedTags(guess.majorCastNames, answer.majorCastNames),
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
    // to spare ranks below an exact match that shares as much.
    ...groupedClue(
      [...new Set(guess.genres)].filter((genre) => !answer.genres.includes(genre)),
      (count) => count * EXTRA_GENRE_POINTS,
      (genres) => `Not ${genres.join(", ")}`,
    ),
  ];
}

export const movieDailyGameRules: DailyGameRules<MovieGameData> = {
  makeClues: makeMovieClues,
  year: releaseYear,
  canBeAnswer: (movie) => hasElements(movie.directors),
};
