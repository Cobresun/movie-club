import { buildIdf, ERA_HALF_LIFE_YEARS, proximityDecay, sum, weightedJaccard } from "../similarity";
import { type WorkSimilarityScorer } from "../types";
import { asTv, tvAirYear } from "./data";
import { type WorkDataSummary } from "@/../lib/types/lists";

// Two episodes of the same series are the comparison a member actually wants
// when scoring one — the show they are watching is the yardstick — so shared
// series identity outweighs every other signal.
const TV_FIELD_WEIGHTS = {
  series: 6,
  creator: 3,
  cast: 2,
  genre: 2,
  network: 1,
  era: 1,
} as const;

export const makeTvSimilarity = (
  corpus: readonly (WorkDataSummary | undefined)[],
): WorkSimilarityScorer => {
  const creatorIdf = buildIdf(corpus, (d) => asTv(d)?.creators ?? []);
  const castIdf = buildIdf(corpus, (d) => asTv(d)?.castNames ?? []);
  const genreIdf = buildIdf(corpus, (d) => asTv(d)?.genres ?? []);
  const networkIdf = buildIdf(corpus, (d) => asTv(d)?.networks ?? []);
  const totalWeight = sum(Object.values(TV_FIELD_WEIGHTS));

  return (target, candidate) => {
    const a = asTv(target);
    const b = asTv(candidate);
    if (a === undefined || b === undefined) return 0;
    const weighted =
      TV_FIELD_WEIGHTS.series * (a.showId === b.showId ? 1 : 0) +
      TV_FIELD_WEIGHTS.creator * weightedJaccard(a.creators, b.creators, creatorIdf) +
      TV_FIELD_WEIGHTS.cast * weightedJaccard(a.castNames, b.castNames, castIdf) +
      TV_FIELD_WEIGHTS.genre * weightedJaccard(a.genres, b.genres, genreIdf) +
      TV_FIELD_WEIGHTS.network * weightedJaccard(a.networks, b.networks, networkIdf) +
      TV_FIELD_WEIGHTS.era * proximityDecay(tvAirYear(a), tvAirYear(b), ERA_HALF_LIFE_YEARS);
    return weighted / totalWeight;
  };
};
