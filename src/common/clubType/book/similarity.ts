import { buildIdf, ERA_HALF_LIFE_YEARS, proximityDecay, sum, weightedJaccard } from "../similarity";
import type { WorkSimilarityScorer } from "../types";
import { WorkDataSummary } from "@/../lib/types/lists";
import { asBook } from "@/common/workDisplay";

/** Page-count difference at which the book-length signal halves. */
const PAGE_HALF_LIFE = 300;

// A shared author dominates, subject is secondary, era/length are gentle nudges.
const BOOK_FIELD_WEIGHTS = {
  author: 5,
  subject: 2.5,
  era: 1,
  length: 0.5,
} as const;

export const makeBookSimilarity = (
  corpus: readonly (WorkDataSummary | undefined)[],
): WorkSimilarityScorer => {
  const authorIdf = buildIdf(corpus, (d) => asBook(d)?.authors ?? []);
  const subjectIdf = buildIdf(corpus, (d) => asBook(d)?.subjects ?? []);
  const totalWeight = sum(Object.values(BOOK_FIELD_WEIGHTS));

  return (target, candidate) => {
    const a = asBook(target);
    const b = asBook(candidate);
    if (a === undefined || b === undefined) return 0;
    const weighted =
      BOOK_FIELD_WEIGHTS.author * weightedJaccard(a.authors, b.authors, authorIdf) +
      BOOK_FIELD_WEIGHTS.subject * weightedJaccard(a.subjects, b.subjects, subjectIdf) +
      BOOK_FIELD_WEIGHTS.era *
        proximityDecay(a.firstPublishYear, b.firstPublishYear, ERA_HALF_LIFE_YEARS) +
      BOOK_FIELD_WEIGHTS.length * proximityDecay(a.numberOfPages, b.numberOfPages, PAGE_HALF_LIFE);
    return weighted / totalWeight;
  };
};
