import type { RouteLocationNormalizedLoaded } from "vue-router";

import { ClubType } from "@/../lib/types/generated/db";

/**
 * One tab in the persistent club navigation (see ClubSectionNav). Every route
 * under `/club/:clubSlug` belongs to exactly one of these, so the bar can show
 * where you are no matter how deep the route goes.
 */
export interface ClubSection {
  /** Route name the tab navigates to. Takes only `clubSlug` as a param. */
  readonly name: string;
  /** Desktop label. */
  readonly label: string;
  /** Mobile label — the bottom bar splits five tabs across the viewport. */
  readonly shortLabel: string;
  /** Material Design Icon name. Reached via a computed, so register in icons.ts. */
  readonly icon: string;
  /**
   * Sections only some clubs have. `undefined` means every club shows it.
   * Awards is movie-only *and* behind a club setting, mirroring the route guard.
   */
  readonly requires?: "awards";
}

export const CLUB_SECTIONS: readonly ClubSection[] = [
  // Reviews and Statistics must not share the bar-chart glyph.
  { name: "Reviews", label: "Reviews", shortLabel: "Reviews", icon: "star-outline" },
  { name: "Watchlists", label: "Lists", shortLabel: "Lists", icon: "format-list-bulleted" },
  { name: "Statistics", label: "Statistics", shortLabel: "Stats", icon: "chart-box-outline" },
  {
    name: "Awards",
    label: "Awards",
    shortLabel: "Awards",
    icon: "trophy-outline",
    requires: "awards",
  },
  { name: "Club", label: "Club", shortLabel: "Club", icon: "account-multiple-outline" },
];

/** Where a club route lands when we have no better idea (see useLastClubSlug). */
export const DEFAULT_CLUB_SECTION = "Reviews";

const SECTION_NAMES = new Set(CLUB_SECTIONS.map((section) => section.name));

/** Whether `name` is one of the section route names (i.e. a tab destination). */
export function isClubSection(name: unknown): name is string {
  return typeof name === "string" && SECTION_NAMES.has(name);
}

/**
 * Whether a club shows this section. Awards is the only conditional one today:
 * movie clubs with the feature switched on, matching the `movieClubOnly` guard.
 *
 * `clubType`/`awardsEnabled` are optional so a caller with a still-loading club
 * can render the bar without flashing Awards in and out — unknown reads as off.
 */
export function isSectionVisible(
  section: ClubSection,
  clubType: ClubType | undefined,
  awardsEnabled: boolean | undefined,
): boolean {
  if (section.requires !== "awards") return true;
  return clubType === ClubType.movie && awardsEnabled === true;
}

/**
 * The section a route belongs to, or `null` for club routes that aren't part of
 * the bar (Club settings, the ClubHome redirect). Reads `matched` rather than
 * the route name so nested routes — `AwardsYear`, its ballot children — still
 * light up their parent tab.
 */
export function sectionNameForRoute(
  route: Pick<RouteLocationNormalizedLoaded, "matched">,
): string | null {
  for (const record of route.matched) {
    if (isClubSection(record.name)) return record.name;
  }
  return null;
}
