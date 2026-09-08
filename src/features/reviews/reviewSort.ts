import { DateTime } from "luxon";

import { isDefined } from "../../../lib/checks/checks.js";
import { Member } from "../../../lib/types/club";
import { DetailedReviewListItem } from "../../../lib/types/lists";
import { AVERAGE_SCORE_ID, memberScoreId, scoreIdMemberId } from "./reviewScores";

const DATE_SORT_ID = "createdDate";

/**
 * A member's avatar reads as meaningless in a "sort by …" menu, so every
 * sortable field carries a plain-language descriptor the dropdown spells out.
 */
export type ReviewSortOption =
  | { id: string; type: "member"; label: string; name: string; image?: string }
  | { id: string; type: "average"; label: string }
  | { id: string; type: "date"; label: string };

export interface ReviewSort {
  id: string;
  desc: boolean;
}

export const reviewSortOptions = (members: Member[]): ReviewSortOption[] => [
  { id: DATE_SORT_ID, type: "date", label: "Date reviewed" },
  ...members.map<ReviewSortOption>((member) => ({
    id: memberScoreId(member.id),
    type: "member",
    label: `${member.name}'s rating`,
    name: member.name,
    image: member.image,
  })),
  { id: AVERAGE_SCORE_ID, type: "average", label: "Average rating" },
];

const sortValue = (review: DetailedReviewListItem, sortId: string): number | undefined => {
  if (sortId === DATE_SORT_ID) {
    const millis = DateTime.fromISO(review.createdDate).toMillis();
    return Number.isNaN(millis) ? undefined : millis;
  }
  if (sortId === AVERAGE_SCORE_ID) {
    return review.scores.average?.score;
  }
  const memberId = scoreIdMemberId(sortId);
  return isDefined(memberId) ? review.scores[memberId]?.score : undefined;
};

/**
 * Works nobody has scored sink to the bottom whichever way the sort runs:
 * reversing the order should not promote the blanks. Clearing the sort hands
 * back the list untouched, in the club's own order.
 */
export const sortReviews = (
  reviews: DetailedReviewListItem[],
  sort: ReviewSort | undefined,
): DetailedReviewListItem[] => {
  if (!isDefined(sort)) return reviews;

  return [...reviews].sort((a, b) => {
    const aValue = sortValue(a, sort.id);
    const bValue = sortValue(b, sort.id);

    if (aValue === undefined) return bValue === undefined ? 0 : 1;
    if (bValue === undefined) return -1;

    return sort.desc ? bValue - aValue : aValue - bValue;
  });
};
