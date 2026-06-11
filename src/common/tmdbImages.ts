import { isDefined } from "../../lib/checks/checks";

const TMDB_PROFILE_BASE_URL = "https://image.tmdb.org/t/p/w185";

/**
 * Builds a TMDB profile (cast/crew headshot) image URL.
 *
 * Returns `undefined` when no profile path is available so callers can fall back
 * to an initials placeholder instead of requesting a broken `…/w185null` image.
 */
export function profileImageUrl(
  profilePath: string | null,
): string | undefined {
  return isDefined(profilePath)
    ? `${TMDB_PROFILE_BASE_URL}${profilePath}`
    : undefined;
}
