import { isDefined } from "../checks/checks.js";

/**
 * The "major cast" of a movie: the actors prominent enough that a recurring
 * appearance is a genuine "familiar face" for the club, rather than an
 * incidental bit-part buried deep in the credits. Used to build the
 * `majorCastNames` shipped on the list/review summary payload, which the
 * review spotlight's `actorMilestone` fact counts against.
 *
 * An actor qualifies if EITHER:
 *
 *  1. They're top-billed — within the leading `MAJOR_CAST_SIZE` of the cast.
 *     TMDB returns cast in billing order and we persist that (`cast_order`),
 *     so the leading slice is the film's headline cast.
 *
 *  2. They're a recognizable star — their personal TMDB popularity clears
 *     `STAR_POPULARITY`. A fixed billing cutoff alone drops a genuinely famous
 *     actor billed just outside it in a large ensemble (e.g. Tom Holland,
 *     billed 12th in Civil War); popularity rescues them independent of this
 *     film's billing depth.
 *
 * `STAR_POPULARITY` is calibrated against real data, not guessed: TMDB's
 * person-popularity is a compressed, daily-trending score, not a 0-100 fame
 * scale. Measured across ~630 club movies the median billed lead sits near 2
 * and barely 1.5% of leads clear 10, while the recognizable actors billed
 * outside the top 5 (Tom Holland ~13, Zendaya ~14, Morgan Freeman / Nicole
 * Kidman / Florence Pugh ~6) cluster from ~6 up — above the ~4 that caps
 * ordinary supporting cast (their 95th percentile). So 6 captures the star
 * band with margin. The score drifts over time, so treat it as a data-
 * calibrated heuristic rather than a hard rule.
 */
export const MAJOR_CAST_SIZE = 5;
export const STAR_POPULARITY = 6;

/** Whether a cast member is "major" given their billing position and
 * popularity. `castOrder` is 0-based (0 = top-billed). */
export function isMajorCastMember(
  castOrder: number,
  popularity: number | null | undefined,
): boolean {
  return castOrder < MAJOR_CAST_SIZE || (isDefined(popularity) && popularity >= STAR_POPULARITY);
}

/** Names of a movie's major cast, preserving the given (billing) order. */
export function selectMajorCastNames(
  cast: {
    name: string;
    castOrder: number;
    popularity: number | null | undefined;
  }[],
): string[] {
  return cast
    .filter((member) => isMajorCastMember(member.castOrder, member.popularity))
    .map((member) => member.name);
}
