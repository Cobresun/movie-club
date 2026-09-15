import { isDefined } from "../../../lib/checks/checks.js";
import { Member } from "../../../lib/types/club";
import { DetailedReviewListItem, ReviewScores } from "../../../lib/types/lists";

/** One score to show for a work: a member's, or the club's average. */
export interface ScoreEntry {
  id: string;
  /** The member's name, or "Average" for the club's aggregate. */
  name: string;
  image?: string;
  /** Absent on the club average. */
  memberId?: string;
  value: number;
  /** A TV season or show score the member did not set, averaged from theirs
   * one level down. */
  averaged?: boolean;
}

export const AVERAGE_SCORE_ID = "score_average";

const MEMBER_SCORE_PREFIX = "member_";

export const memberScoreId = (memberId: string) => `${MEMBER_SCORE_PREFIX}${memberId}`;

export const scoreIdMemberId = (scoreId: string) =>
  scoreId.startsWith(MEMBER_SCORE_PREFIX) ? scoreId.slice(MEMBER_SCORE_PREFIX.length) : undefined;

/** Scores are stored to full precision but only ever read to two decimals. */
const roundScore = (score: number) => Math.round(score * 100) / 100;

/**
 * The scores a work actually has, in club-member order with the average last.
 * Members who have not scored the work are left out rather than shown blank.
 */
export const workScoreEntries = (work: DetailedReviewListItem, members: Member[]): ScoreEntry[] =>
  scoreEntries(work.scores, members);

/** {@link workScoreEntries} for a bare score map, such as a TV season's, whose
 * `averagedMemberIds` are marked as averaged rather than set. */
export const scoreEntries = (
  scores: ReviewScores,
  members: Member[],
  averagedMemberIds: ReadonlySet<string> = new Set(),
): ScoreEntry[] => {
  const entries = members.flatMap<ScoreEntry>((member) => {
    const score = scores[member.id]?.score;
    if (score === undefined) return [];
    return [
      {
        id: memberScoreId(member.id),
        name: member.name,
        image: member.image,
        memberId: member.id,
        value: roundScore(score),
        averaged: averagedMemberIds.has(member.id),
      },
    ];
  });

  const average = scores.average?.score;
  if (average !== undefined) {
    entries.push({ id: AVERAGE_SCORE_ID, name: "Average", value: roundScore(average) });
  }

  return entries;
};

/**
 * A score the club hides until the reader has skin in the game — everyone
 * else's, and the average that would give them away. The reader's own score is
 * always theirs to see.
 */
export const isOthersScore = (entry: ScoreEntry, currentUserId?: string) =>
  !isDefined(currentUserId) || entry.memberId !== currentUserId;

/** Whether the reader has a score of their own in `scores` — set there, or,
 * for a TV season or show, averaged from theirs one level down. */
export const hasOwnScore = (scores: ReviewScores, currentUserId?: string) =>
  isDefined(currentUserId) && isDefined(scores[currentUserId]);

export const isScoreBlurred = (
  entry: ScoreEntry,
  currentUserId: string | undefined,
  revealed: boolean,
) => !revealed && isOthersScore(entry, currentUserId);
