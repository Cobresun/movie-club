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
} from "../dailyGame.js";
import { type TvDataSummary } from "../types/tv";
import { tvAirYear } from "./airYear.js";

// A shared creator is the strongest link two shows can have, a shared star
// half that. Network, genres, language and decade are worth what their rarity
// says. A genre the answer doesn't have shows as a miss, so a shared one
// always shows, however common.
const CREATOR_POINTS = 10;
const STAR_POINTS = 5;
const NETWORK_POINTS = { min: 1, max: 3, dropMajority: true };
const GENRE_POINTS = { min: 1, max: 4, dropMajority: false };
const LANGUAGE_POINTS = { min: 1, max: 4, dropMajority: true };
const DECADE_POINTS = { min: 1, max: 3, dropMajority: true };
const EXTRA_GENRE_POINTS = -1;

/**
 * A show's aggregate credits list everyone who ever appeared, most episodes
 * first, so the leading names are its regulars. A one-episode guest star is
 * no reason to call two shows alike.
 */
const MAIN_CAST_SIZE = 8;

const mainCast = (show: TvDataSummary) => show.castNames.slice(0, MAIN_CAST_SIZE);

const languages = (show: TvDataSummary) =>
  hasValue(show.originalLanguage) ? [show.originalLanguage] : [];

/** The decade a show premiered in, however long it ran. */
const decades = (show: TvDataSummary) => decadeTags(tvAirYear(show));

export function makeTvClues(pool: readonly TvDataSummary[]) {
  const networkPoints = rarityPoints(pool, (show) => show.networks, NETWORK_POINTS);
  const genrePoints = rarityPoints(pool, (show) => show.genres, GENRE_POINTS);
  const languagePoints = rarityPoints(pool, languages, LANGUAGE_POINTS);
  const decadePoints = rarityPoints(pool, decades, DECADE_POINTS);

  return (guess: TvDataSummary, answer: TvDataSummary): ScoredClue[] => [
    // A creating team is one creator's worth.
    ...groupedClue(
      sharedTags(guess.creators, answer.creators),
      () => CREATOR_POINTS,
      (names) => `Same creator: ${names.join(" & ")}`,
    ),
    ...groupedClue(
      sharedTags(mainCast(guess), mainCast(answer)),
      (count) => count * STAR_POINTS,
      (names) => `Also stars ${names.join(", ")}`,
    ),
    ...sharedClues(
      guess.networks,
      answer.networks,
      networkPoints,
      (network) => `Also on ${network}`,
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
      (decade) => `Also premiered in the ${decade}s`,
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

export const tvDailyGameRules: DailyGameRules<TvDataSummary> = {
  makeClues: makeTvClues,
  year: tvAirYear,
  canBeAnswer: (show) => hasElements(show.creators),
};
