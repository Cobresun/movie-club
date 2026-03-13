import { hasElements, hasValue } from "../../../lib/checks/checks.js";
import { ClubPreview } from "../../../lib/types/club";

const LAST_CLUB_SLUG_KEY = "lastClubSlug";

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

export function resolveDefaultClubSlug(
  clubs: ReadonlyArray<ClubPreview> | undefined,
): string | null {
  if (!hasElements(clubs)) return null;

  const lastSlug = getLastClubSlug();
  return hasValue(lastSlug) && clubs.some((c) => c.slug === lastSlug)
    ? lastSlug
    : clubs[0].slug;
}
