import { hasElements, hasValue } from "../../../lib/checks/checks.js";
import { ClubPreview } from "../../../lib/types/club";

export const LAST_CLUB_SLUG_KEY = "lastClubSlug";

export function resolveDefaultClubSlug(
  clubs: ReadonlyArray<ClubPreview> | undefined,
): string | null {
  if (!hasElements(clubs)) return null;

  const lastSlug = localStorage.getItem(LAST_CLUB_SLUG_KEY);
  return hasValue(lastSlug) && clubs.some((c) => c.slug === lastSlug)
    ? lastSlug
    : clubs[0].slug;
}
