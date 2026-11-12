import { hasValue } from "../../../lib/checks/checks.js";
import { type WorkType } from "../../../lib/types/generated/db";
import { type MemberScoredWork, type WorkListItem } from "../../../lib/types/lists";

/**
 * Identifies the same movie/book/episode across clubs — each club owns its own
 * `work` row, so only the provider's id ties them together. Works with no
 * external id carry no such identity and never match one another.
 */
export function sameWorkKey(type: WorkType, externalId: string | undefined): string | undefined {
  return hasValue(externalId) ? `${type}:${externalId}` : undefined;
}

export interface OtherClubScore {
  clubId: string;
  clubName: string;
  score: number;
}

/**
 * The scores the user already gave this same work in their other clubs, most
 * recent first, from the `GET /api/member/scores` payload.
 */
export function scoresFromOtherClubs(
  scores: readonly MemberScoredWork[],
  target: Pick<WorkListItem, "type" | "externalId">,
  currentClubId: string,
): OtherClubScore[] {
  const key = sameWorkKey(target.type, target.externalId);
  if (!hasValue(key)) return [];

  return scores
    .filter(
      (scored) =>
        scored.clubId !== currentClubId &&
        Number.isFinite(scored.score) &&
        sameWorkKey(scored.type, scored.externalId) === key,
    )
    .sort((a, b) => b.scoredDate.localeCompare(a.scoredDate))
    .map(({ clubId, clubName, score }) => ({ clubId, clubName, score }));
}
