import { hasValue } from "../checks/checks.js";
import {
  buildIdf,
  ERA_HALF_LIFE_YEARS,
  proximityDecay,
  sum,
  weightedJaccard,
} from "../similarity.js";
import { type MovieDataSummary } from "../types/movie";
import { releaseYear } from "./releaseYear.js";

// A shared director dominates, cast/studio/genre are secondary, era/language
// are gentle nudges.
const MOVIE_FIELD_WEIGHTS = {
  director: 5,
  cast: 2,
  company: 1.5,
  genre: 2,
  era: 1,
  language: 0.5,
} as const;

/** What two movies are compared on: the only metadata a scorer reads. */
export interface MovieSimilarityData {
  directors: readonly { name: string }[];
  majorCastNames: readonly string[];
  production_companies: readonly string[];
  genres: readonly string[];
  release_date?: MovieDataSummary["release_date"];
  original_language?: MovieDataSummary["original_language"];
}

export type MovieScorer = (target: MovieSimilarityData, candidate: MovieSimilarityData) => number;

function names(people: readonly { name: string }[]): string[] {
  return people.map((person) => person.name);
}

/**
 * How alike two movies are, in [0,1], weighted by how rare each shared tag is
 * in `corpus`. Works with no cached metadata still count towards the corpus
 * size, so pass them as `undefined` rather than dropping them.
 */
export const makeMovieScorer = (
  corpus: readonly (MovieSimilarityData | undefined)[],
): MovieScorer => {
  const directorIdf = buildIdf(corpus, (d) => names(d?.directors ?? []));
  // Major cast only (see lib/movie/majorCast.ts): the full credit list runs to
  // extras and stunt performers, whose length dilutes a shared lead in a big
  // ensemble and whose rarity makes a shared bit-part outweigh one.
  const castIdf = buildIdf(corpus, (d) => d?.majorCastNames ?? []);
  const companyIdf = buildIdf(corpus, (d) => d?.production_companies ?? []);
  const genreIdf = buildIdf(corpus, (d) => d?.genres ?? []);
  const totalWeight = sum(Object.values(MOVIE_FIELD_WEIGHTS));

  return (a, b) => {
    const sameLanguage =
      hasValue(a.original_language) && a.original_language === b.original_language;
    const weighted =
      MOVIE_FIELD_WEIGHTS.director *
        weightedJaccard(names(a.directors), names(b.directors), directorIdf) +
      MOVIE_FIELD_WEIGHTS.cast * weightedJaccard(a.majorCastNames, b.majorCastNames, castIdf) +
      MOVIE_FIELD_WEIGHTS.company *
        weightedJaccard(a.production_companies, b.production_companies, companyIdf) +
      MOVIE_FIELD_WEIGHTS.genre * weightedJaccard(a.genres, b.genres, genreIdf) +
      MOVIE_FIELD_WEIGHTS.era *
        proximityDecay(releaseYear(a), releaseYear(b), ERA_HALF_LIFE_YEARS) +
      MOVIE_FIELD_WEIGHTS.language * (sameLanguage ? 1 : 0);
    return weighted / totalWeight;
  };
};
