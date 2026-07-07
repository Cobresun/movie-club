import { computed, shallowRef } from "vue";

import {
  answerComparison,
  ComparisonAnswer,
  MAX_COMPARISONS,
  ScoredCandidate,
  startSession,
} from "./scoreAssistLogic";
import { DetailedReviewListItem } from "../../../../lib/types/lists";

/**
 * Reactive shell around the pure session logic in scoreAssistLogic.ts. Takes
 * plain (non-reactive) arguments on purpose: ScoreAssistModal is mounted with
 * `v-if` + `:key="target.id"`, so a different target work means a fresh
 * component and a fresh session - no watchers needed.
 */
export function useScoreAssist(
  target: DetailedReviewListItem,
  candidates: readonly ScoredCandidate[],
) {
  const session = shallowRef(startSession(target, candidates));

  const answer = (choice: ComparisonAnswer) => {
    session.value = answerComparison(session.value, choice);
  };
  const restart = () => {
    session.value = startSession(target, candidates);
  };

  const pivot = computed(() => session.value.pivot);
  const result = computed(() => session.value.result);
  const progressLabel = computed(
    () =>
      `Comparison ${session.value.comparisons + 1} of up to ${MAX_COMPARISONS}`,
  );

  return { session, pivot, result, answer, restart, progressLabel };
}
