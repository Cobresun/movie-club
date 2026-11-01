import { type WorkSimilarityScorer } from "../types";
import { isDefined } from "@/../lib/checks/checks";
import { makeMovieScorer } from "@/../lib/movie/similarity";
import { type WorkDataSummary } from "@/../lib/types/lists";
import { asMovie } from "@/common/workDisplay";

export const makeMovieSimilarity = (
  corpus: readonly (WorkDataSummary | undefined)[],
): WorkSimilarityScorer => {
  const score = makeMovieScorer(corpus.map((data) => asMovie(data)));
  return (target, candidate) => {
    const a = asMovie(target);
    const b = asMovie(candidate);
    return isDefined(a) && isDefined(b) ? score(a, b) : 0;
  };
};
