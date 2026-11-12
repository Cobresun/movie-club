import { type Component } from "vue";

import { ClubType } from "../../../lib/types/generated/db";
import { type DetailedReviewListItem } from "../../../lib/types/lists";
import SharedShowBreakdown from "./components/tv/SharedShowBreakdown.vue";
import { buildShowTree, type LevelScores } from "./reviewTree";

interface SharedReviewLayout {
  /** Rendered beneath the work's scores, given the club's reviews, the shared
   * work's id and the club's members. */
  breakdown?: Component;
  /** The work's scores as the club sees them, where they are more than the
   * scores set on the work itself. */
  rollup?: (reviews: DetailedReviewListItem[], workId: string) => LevelScores | undefined;
}

/**
 * What the public shared-review page adds for a club type. A TV show reads
 * as the club sees it in the app: each member's show score, or their average
 * over the episodes they scored, and a breakdown into those seasons and
 * episodes.
 *
 * Kept apart from `REVIEW_LAYOUTS` so the public page does not load the
 * club's own review components.
 */
export const SHARED_REVIEW_LAYOUTS: Record<ClubType, SharedReviewLayout> = {
  [ClubType.MOVIE]: {},
  [ClubType.BOOK]: {},
  [ClubType.TV]: {
    breakdown: SharedShowBreakdown,
    rollup: (reviews, workId) => buildShowTree(reviews).find((show) => show.workId === workId),
  },
};
