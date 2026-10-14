import { buildIdf, ERA_HALF_LIFE_YEARS, proximityDecay, sum, weightedJaccard } from "../similarity";
import type { WorkSimilarityScorer } from "../types";
import { releaseYear } from "./display";
import { hasValue } from "@/../lib/checks/checks";
import { WorkDataSummary } from "@/../lib/types/lists";
import { asMovie } from "@/common/workDisplay";

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

function names(people: readonly { name: string }[]): string[] {
  return people.map((person) => person.name);
}

export const makeMovieSimilarity = (
  corpus: readonly (WorkDataSummary | undefined)[],
): WorkSimilarityScorer => {
  const directorIdf = buildIdf(corpus, (d) => names(asMovie(d)?.directors ?? []));
  // Bulk payloads carry cast names only (castNames); full actor objects live in
  // the per-work detail payload and aren't available for pivot scoring.
  const castIdf = buildIdf(corpus, (d) => asMovie(d)?.castNames ?? []);
  const companyIdf = buildIdf(corpus, (d) => asMovie(d)?.production_companies ?? []);
  const genreIdf = buildIdf(corpus, (d) => asMovie(d)?.genres ?? []);
  const totalWeight = sum(Object.values(MOVIE_FIELD_WEIGHTS));

  return (target, candidate) => {
    const a = asMovie(target);
    const b = asMovie(candidate);
    if (a === undefined || b === undefined) return 0;
    const sameLanguage =
      hasValue(a.original_language) && a.original_language === b.original_language;
    const weighted =
      MOVIE_FIELD_WEIGHTS.director *
        weightedJaccard(names(a.directors), names(b.directors), directorIdf) +
      MOVIE_FIELD_WEIGHTS.cast * weightedJaccard(a.castNames, b.castNames, castIdf) +
      MOVIE_FIELD_WEIGHTS.company *
        weightedJaccard(a.production_companies, b.production_companies, companyIdf) +
      MOVIE_FIELD_WEIGHTS.genre * weightedJaccard(a.genres, b.genres, genreIdf) +
      MOVIE_FIELD_WEIGHTS.era *
        proximityDecay(releaseYear(a), releaseYear(b), ERA_HALF_LIFE_YEARS) +
      MOVIE_FIELD_WEIGHTS.language * (sameLanguage ? 1 : 0);
    return weighted / totalWeight;
  };
};
