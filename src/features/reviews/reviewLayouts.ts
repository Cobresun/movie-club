import { Component } from "vue";

import { ClubType } from "../../../lib/types/generated/db";
import GalleryView from "./components/GalleryView.vue";
import ShowGalleryView from "./components/ShowGalleryView.vue";

/**
 * How a club type lays its reviews out. Movies and books are a flat grid of
 * one card per scored work; TV is a show that opens into seasons and episodes,
 * because a club working through a series would otherwise bury every other
 * entry under sixty cards.
 *
 * Feature-local rather than part of `CLUB_TYPE_CONFIG`: it wires up reviews
 * components, and `src/common` must not import from a feature (see
 * code-quality.md).
 */
export const REVIEW_LAYOUTS: Record<ClubType, Component> = {
  [ClubType.movie]: GalleryView,
  [ClubType.book]: GalleryView,
  [ClubType.tv]: ShowGalleryView,
};
