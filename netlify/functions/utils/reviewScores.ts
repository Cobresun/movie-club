import { hasValue, isDefined } from "../../../lib/checks/checks.js";
import { ReviewScores } from "../../../lib/types/lists.js";

// A single review row, as surfaced by the queries that feed the scores map
// (`getReviewList` and `getReviewsByWorkId`). Both select these columns
// directly, so callers hand their rows off without any remapping.
export interface ScoreEntry {
  user_id: string | null;
  review_id: string | null;
  score: string | null;
  created_date: Date | null;
}

// Builds the `scores` map for a single work: one entry per current member plus
// a synthetic `average`. Filters to `memberIds` so a departed member's stale
// score doesn't reappear, and returns an empty object when no member has scored.
export function buildReviewScores(entries: ScoreEntry[], memberIds: Set<string>): ReviewScores {
  const userScores = entries.reduce<ReviewScores>((acc, entry) => {
    if (
      hasValue(entry.user_id) &&
      hasValue(entry.review_id) &&
      hasValue(entry.score) &&
      isDefined(entry.created_date) &&
      memberIds.has(entry.user_id)
    ) {
      acc[entry.user_id] = {
        id: entry.review_id,
        created_date: entry.created_date.toISOString(),
        score: parseFloat(entry.score),
      };
    }
    return acc;
  }, {});

  const scores = Object.values(userScores);
  if (scores.length === 0) return {};

  return {
    ...userScores,
    average: {
      id: "average",
      created_date: new Date().toISOString(),
      score: scores.reduce((sum, review) => sum + review.score, 0) / scores.length,
    },
  };
}
