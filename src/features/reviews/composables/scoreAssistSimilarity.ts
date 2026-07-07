import { WorkType } from "../../../../lib/types/generated/db";
import { DetailedWorkData } from "../../../../lib/types/lists";

import { asBook, asMovie } from "@/common/workDisplay";

/**
 * How strongly a shared primary credit (director / author) counts towards
 * similarity, relative to a shared category (genre / subject).
 */
const PRIMARY_CREDIT_WEIGHT = 3;
const CATEGORY_WEIGHT = 1;

type WorkSimilarity = (
  target: DetailedWorkData | undefined,
  candidate: DetailedWorkData | undefined,
) => number;

// Case-insensitive: Google Books subjects vary in casing between volumes.
function sharedCount(a: readonly string[], b: readonly string[]): number {
  const normalized = new Set(a.map((value) => value.toLowerCase()));
  return b.filter((value) => normalized.has(value.toLowerCase())).length;
}

/**
 * Feature-local club-type registry (see .claude/rules/code-quality.md):
 * similarity is Score Assist logic over the lib work-data shapes, so it lives
 * here keyed by WorkType rather than in the shared CLUB_TYPE_CONFIG. The
 * exhaustive Record means a new work type won't compile until it defines its
 * notion of similarity.
 */
const SIMILARITY_BY_WORK_TYPE: Record<WorkType, WorkSimilarity> = {
  [WorkType.movie]: (target, candidate) => {
    const a = asMovie(target);
    const b = asMovie(candidate);
    if (a === undefined || b === undefined) return 0;
    return (
      sharedCount(
        a.directors.map((director) => director.name),
        b.directors.map((director) => director.name),
      ) *
        PRIMARY_CREDIT_WEIGHT +
      sharedCount(a.genres, b.genres) * CATEGORY_WEIGHT
    );
  },
  [WorkType.book]: (target, candidate) => {
    const a = asBook(target);
    const b = asBook(candidate);
    if (a === undefined || b === undefined) return 0;
    return (
      sharedCount(a.authors, b.authors) * PRIMARY_CREDIT_WEIGHT +
      sharedCount(a.subjects, b.subjects) * CATEGORY_WEIGHT
    );
  },
};

/**
 * How alike two works are, for preferring familiar comparison points while
 * binary-searching a score. Missing or mismatched-kind metadata scores 0, so
 * pivot selection degrades gracefully to pure score-midpoint distance.
 */
export function workSimilarity(
  type: WorkType,
  target: DetailedWorkData | undefined,
  candidate: DetailedWorkData | undefined,
): number {
  return SIMILARITY_BY_WORK_TYPE[type](target, candidate);
}
