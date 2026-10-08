import { Component } from "vue";

import { ClubType } from "../../../lib/types/generated/db";
import { DetailedReviewListItem } from "../../../lib/types/lists";
import GalleryView from "./components/GalleryView.vue";
import ShowListView from "./components/ShowListView.vue";
import { wholeShows } from "./reviewTree";

interface ReviewLayout {
  component: Component;
  /** The reviews the layout renders, given every review and the ones the
   * search and filters matched. */
  select: (
    all: DetailedReviewListItem[],
    matched: DetailedReviewListItem[],
  ) => DetailedReviewListItem[];
}

const gallery: ReviewLayout = { component: GalleryView, select: (_all, matched) => matched };

/**
 * How a club type lays its reviews out. Movies and books are a flat grid of
 * one card per scored work; TV is a list of shows that open in place onto
 * their seasons and episodes, because a club working through a series would
 * otherwise bury every other entry under sixty cards. A show is built from
 * all of its works, so a match anywhere in it keeps the whole show.
 *
 * Feature-local rather than part of `CLUB_TYPE_CONFIG`: it wires up reviews
 * components, and `src/common` must not import from a feature (see
 * code-quality.md).
 */
export const REVIEW_LAYOUTS: Record<ClubType, ReviewLayout> = {
  [ClubType.movie]: gallery,
  [ClubType.book]: gallery,
  [ClubType.tv]: { component: ShowListView, select: wholeShows },
};
