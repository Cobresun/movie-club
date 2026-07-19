import { hasValue, isDefined } from "../../../../lib/checks/checks.js";
import { WorkType } from "../../../../lib/types/generated/db";
import {
  DetailedReviewListItem,
  WorkDataSummary,
} from "../../../../lib/types/lists";

import { makeWorkSimilarity, WorkSimilarityScorer } from "@/common/clubType";

/**
 * Score Assist: converge on a 0-10 score suggestion for a target work by
 * asking the user to compare it against works they have already scored,
 * binary-searching their own score scale. Pure logic - no Vue here - so the
 * whole state machine is unit-testable; useScoreAssist.ts wraps it in a ref.
 */

/** The trigger stays hidden until the user has this many scored works. */
export const MIN_SCORED_WORKS_FOR_ASSIST = 5;
export const MAX_COMPARISONS = 5;
/** Stop refining once the known score bracket is this narrow. */
export const CONVERGED_BRACKET_WIDTH = 1;

export interface ScoredCandidate {
  workId: string;
  title: string;
  imageUrl?: string;
  externalData?: WorkDataSummary;
  /** The current user's score for this work. */
  score: number;
}

/** The user's verdict on the current comparison, relative to the TARGET. */
export type ComparisonAnswer = "more" | "less" | "same" | "skip";

export interface ScoreAssistResult {
  /** Rounded to the nearest 0.5 and clamped to 0-10. */
  suggestedScore: number;
  kind: "converged" | "matched" | "aboveAll" | "belowAll";
  /** Bracketing works that contextualize how the suggestion was derived. */
  lowerWork?: ScoredCandidate;
  upperWork?: ScoredCandidate;
  /** The work the user called "about the same" (kind === "matched"). */
  matchedWork?: ScoredCandidate;
}

export interface ScoreAssistSession {
  readonly targetType: WorkType;
  readonly targetData?: WorkDataSummary;
  /**
   * Similarity scorer, IDF-calibrated to this session's candidate pool once at
   * startSession and reused for every pivot comparison.
   */
  readonly similarity: WorkSimilarityScorer;
  /** Sorted ascending by score (title tie-break). */
  readonly candidates: readonly ScoredCandidate[];
  /**
   * Known score bracket. The bounds are exclusive once backed by an answered
   * work (lowerWork/upperWork), inclusive while still at the initial 0/10 -
   * otherwise works the user scored exactly 0 or 10 could never be pivots.
   */
  readonly lo: number;
  readonly hi: number;
  readonly lowerWork?: ScoredCandidate;
  readonly upperWork?: ScoredCandidate;
  /** Every pivot already offered, answered or skipped - never re-offered. */
  readonly askedWorkIds: readonly string[];
  /** Answered comparisons only; skips don't count against MAX_COMPARISONS. */
  readonly comparisons: number;
  /** The work currently on screen for comparison; unset once done. */
  readonly pivot?: ScoredCandidate;
  readonly result?: ScoreAssistResult;
}

export function buildCandidatePool(
  reviews: readonly DetailedReviewListItem[],
  userId: string,
  targetWorkId: string,
): ScoredCandidate[] {
  return reviews
    .flatMap<ScoredCandidate>((item) => {
      if (item.id === targetWorkId) return [];
      // Indexing by userId (never iterating keys) is what keeps the synthetic
      // "average" entry in `scores` out of the pool.
      const score = item.scores[userId]?.score;
      if (!isDefined(score) || !Number.isFinite(score)) return [];
      return [
        {
          workId: item.id,
          title: item.title,
          imageUrl: item.imageUrl,
          externalData: item.externalData,
          score,
        },
      ];
    })
    .sort((a, b) =>
      a.score !== b.score ? a.score - b.score : a.title.localeCompare(b.title),
    );
}

export function isScoreAssistEligible(
  reviews: readonly DetailedReviewListItem[] | undefined,
  userId: string | undefined,
  targetWorkId: string,
): boolean {
  if (reviews === undefined || !hasValue(userId)) return false;
  return (
    buildCandidatePool(reviews, userId, targetWorkId).length >=
    MIN_SCORED_WORKS_FOR_ASSIST
  );
}

export function startSession(
  target: DetailedReviewListItem,
  candidates: readonly ScoredCandidate[],
): ScoreAssistSession {
  const sorted = [...candidates].sort((a, b) =>
    a.score !== b.score ? a.score - b.score : a.title.localeCompare(b.title),
  );
  const session: ScoreAssistSession = {
    targetType: target.type,
    targetData: target.externalData,
    similarity: makeWorkSimilarity(
      target.type,
      sorted.map((candidate) => candidate.externalData),
    ),
    candidates: sorted,
    lo: 0,
    hi: 10,
    askedWorkIds: [],
    comparisons: 0,
  };
  return withNextStep(session);
}

export function answerComparison(
  session: ScoreAssistSession,
  answer: ComparisonAnswer,
): ScoreAssistSession {
  const pivot = session.pivot;
  if (!isDefined(pivot) || isDefined(session.result)) return session;
  const askedWorkIds = [...session.askedWorkIds, pivot.workId];
  switch (answer) {
    case "more":
      return withNextStep({
        ...session,
        lo: pivot.score,
        lowerWork: pivot,
        askedWorkIds,
        comparisons: session.comparisons + 1,
        pivot: undefined,
      });
    case "less":
      return withNextStep({
        ...session,
        hi: pivot.score,
        upperWork: pivot,
        askedWorkIds,
        comparisons: session.comparisons + 1,
        pivot: undefined,
      });
    case "same":
      return {
        ...session,
        askedWorkIds,
        pivot: undefined,
        result: {
          kind: "matched",
          suggestedScore: clampScore(roundHalf(pivot.score)),
          matchedWork: pivot,
        },
      };
    case "skip":
      return withNextStep({ ...session, askedWorkIds, pivot: undefined });
  }
}

function withNextStep(session: ScoreAssistSession): ScoreAssistSession {
  if (
    session.hi - session.lo <= CONVERGED_BRACKET_WIDTH ||
    session.comparisons >= MAX_COMPARISONS
  ) {
    return finishSession(session);
  }
  const pivot = selectPivot(session);
  if (!isDefined(pivot)) return finishSession(session);
  return { ...session, pivot };
}

function eligiblePivots(session: ScoreAssistSession): ScoredCandidate[] {
  return session.candidates.filter((candidate) => {
    if (session.askedWorkIds.includes(candidate.workId)) return false;
    // Strict once a bound is backed by an answered work: answering a pivot at
    // score s permanently rules out every other work scored exactly s, which
    // guarantees the eligible set shrinks and the search terminates.
    const aboveLo = isDefined(session.lowerWork)
      ? candidate.score > session.lo
      : candidate.score >= session.lo;
    const belowHi = isDefined(session.upperWork)
      ? candidate.score < session.hi
      : candidate.score <= session.hi;
    return aboveLo && belowHi;
  });
}

// Pivot scoring weights. Similarity (in [0,1]) leads, so a clearly more familiar
// comparison still wins. The positional term is a bounded nudge: it only decides
// between candidates of comparable similarity, keeping the pivot near the centre
// of the window so the binary search stays balanced instead of drifting to a
// marginally-more-similar edge candidate. Within that term, closeness to the
// bracket's score midpoint dominates and rank centrality only breaks its ties -
// preserving the original ordering when no metadata is available.
const POSITION_WEIGHT = 0.3;
const RANK_TIEBREAK_WEIGHT = 0.01;

/**
 * Pick the next comparison work from the rank-middle third of the eligible
 * candidates (rank, not score-midpoint, so clumped scores still halve the
 * search space). Each candidate is scored as similarity + a bounded positional
 * term (score-midpoint closeness, rank centrality as a tiebreak); the highest
 * wins, exact ties breaking to the lowest index. Deterministic on purpose -
 * tests can assert exact pivots.
 */
function selectPivot(session: ScoreAssistSession): ScoredCandidate | undefined {
  const eligible = eligiblePivots(session);
  if (eligible.length === 0) return undefined;
  const start = Math.floor(eligible.length / 3);
  const end = Math.max(start + 1, Math.ceil((2 * eligible.length) / 3));
  const scoreMidpoint = (session.lo + session.hi) / 2;
  const windowMiddle = (start + end - 1) / 2;

  // Normalise the two positional distances against the window's own spread so
  // each lands in [0,1]. A zero spread (single item, or every score equal) makes
  // that term uniform rather than dividing by zero.
  let maxScoreDistance = 0;
  let maxRankDistance = 0;
  for (let i = start; i < end; i++) {
    maxScoreDistance = Math.max(
      maxScoreDistance,
      Math.abs(eligible[i].score - scoreMidpoint),
    );
    maxRankDistance = Math.max(maxRankDistance, Math.abs(i - windowMiddle));
  }

  let best: ScoredCandidate | undefined;
  let bestScore = -Infinity;
  for (let i = start; i < end; i++) {
    const candidate = eligible[i];
    const similarity = session.similarity(
      session.targetData,
      candidate.externalData,
    );
    const scoreProximity =
      maxScoreDistance === 0
        ? 1
        : 1 - Math.abs(candidate.score - scoreMidpoint) / maxScoreDistance;
    const rankCentrality =
      maxRankDistance === 0
        ? 1
        : 1 - Math.abs(i - windowMiddle) / maxRankDistance;
    const positional = scoreProximity + RANK_TIEBREAK_WEIGHT * rankCentrality;
    const combined = similarity + POSITION_WEIGHT * positional;
    if (combined > bestScore) {
      best = candidate;
      bestScore = combined;
    }
  }
  return best;
}

function finishSession(session: ScoreAssistSession): ScoreAssistSession {
  const { lo, hi, lowerWork, upperWork, candidates } = session;
  const poolMax =
    candidates.length > 0 ? candidates[candidates.length - 1] : undefined;
  const poolMin = candidates.length > 0 ? candidates[0] : undefined;

  let result: ScoreAssistResult;
  if (
    isDefined(lowerWork) &&
    !isDefined(upperWork) &&
    lowerWork.score === poolMax?.score
  ) {
    // Liked it more than their top-rated work: nudge just above it rather
    // than jumping to the midpoint of (top, 10].
    result = {
      kind: "aboveAll",
      suggestedScore: clampScore(roundHalf(lo + 0.5)),
      lowerWork,
    };
  } else if (
    isDefined(upperWork) &&
    !isDefined(lowerWork) &&
    upperWork.score === poolMin?.score
  ) {
    result = {
      kind: "belowAll",
      suggestedScore: clampScore(roundHalf(hi - 0.5)),
      upperWork,
    };
  } else {
    result = {
      kind: "converged",
      suggestedScore: clampScore(roundHalf((lo + hi) / 2)),
      lowerWork,
      upperWork,
    };
  }
  return { ...session, pivot: undefined, result };
}

function roundHalf(score: number): number {
  return Math.round(score * 2) / 2;
}

function clampScore(score: number): number {
  return Math.min(10, Math.max(0, score));
}
