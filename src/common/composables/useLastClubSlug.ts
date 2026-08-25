import type { RouteLocationNormalized } from "vue-router";

import { hasElements, hasValue, isDefined } from "../../../lib/checks/checks.js";
import { ClubPreview } from "../../../lib/types/club";
import { DEFAULT_CLUB_SECTION, isClubSection, sectionNameForRoute } from "../clubSections";

const LAST_CLUB_SLUG_KEY = "lastClubSlug";
const LAST_CLUB_SECTION_KEY = "lastClubSection";

export function getLastClubSlug(): string | null {
  const slug = localStorage.getItem(LAST_CLUB_SLUG_KEY);
  return hasValue(slug) ? slug : null;
}

export function setLastClubSlug(slug: string): void {
  localStorage.setItem(LAST_CLUB_SLUG_KEY, slug);
}

export function clearLastClubSlug(): void {
  localStorage.removeItem(LAST_CLUB_SLUG_KEY);
}

// Sections are stored per club — switching clubs should land you on the section
// you last used *in that club*, not the one you were reading a moment ago.
type LastSections = Record<string, string>;

function readLastSections(): LastSections {
  const raw = localStorage.getItem(LAST_CLUB_SECTION_KEY);
  if (!hasValue(raw)) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    // Anything that isn't a plain object (an older value, a hand-edited entry)
    // is discarded rather than trusted — the fallback is a working default.
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as LastSections)
      : {};
  } catch {
    return {};
  }
}

/**
 * The section route name this member last visited in `slug`, or the default
 * when there is none (a first visit, or a stored name that no longer exists).
 */
export function getLastClubSection(slug: string): string {
  const stored = readLastSections()[slug];
  return isClubSection(stored) ? stored : DEFAULT_CLUB_SECTION;
}

export function setLastClubSection(slug: string, section: string): void {
  if (!isClubSection(section)) return;
  const sections = readLastSections();
  sections[slug] = section;
  localStorage.setItem(LAST_CLUB_SECTION_KEY, JSON.stringify(sections));
}

/**
 * Records the section a navigation landed on, so a later bare club URL reopens
 * it. Routes outside the section bar (club settings, the redirect itself) leave
 * the stored section alone.
 */
export function rememberClubSection(
  route: Pick<RouteLocationNormalized, "params" | "matched">,
): void {
  const slug = route.params.clubSlug;
  const section = sectionNameForRoute(route);
  if (typeof slug === "string" && isDefined(section)) {
    setLastClubSection(slug, section);
  }
}

export function resolveDefaultClubSlug(
  clubs: ReadonlyArray<ClubPreview> | undefined,
): string | null {
  if (!hasElements(clubs)) return null;

  const lastSlug = getLastClubSlug();
  return hasValue(lastSlug) && clubs.some((c) => c.slug === lastSlug) ? lastSlug : clubs[0].slug;
}
