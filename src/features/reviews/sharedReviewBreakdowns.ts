import { type Component } from "vue";

import { ClubType } from "../../../lib/types/generated/db";
import SharedShowBreakdown from "./components/tv/SharedShowBreakdown.vue";

/**
 * What the public shared-review page adds beneath a work's scores, by club
 * type: a TV show breaks down into the seasons and episodes its scores are
 * built from. Each takes the club's reviews, the shared work's id and the
 * club's members.
 *
 * Kept apart from `REVIEW_LAYOUTS` so the public page does not load the
 * club's own review components.
 */
export const SHARED_REVIEW_BREAKDOWNS: Record<ClubType, Component | undefined> = {
  [ClubType.MOVIE]: undefined,
  [ClubType.BOOK]: undefined,
  [ClubType.TV]: SharedShowBreakdown,
};
