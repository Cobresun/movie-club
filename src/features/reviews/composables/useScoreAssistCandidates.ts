import { computed, MaybeRefOrGetter, toValue } from "vue";

import { hasValue } from "../../../../lib/checks/checks.js";
import { ClubType } from "../../../../lib/types/generated/db";
import { buildCandidatePool } from "./scoreAssistLogic";
import { useClub, useClubSlug } from "@/service/useClub";
import { useReviewsList } from "@/service/useList";
import { useMemberScores, useUser } from "@/service/useUser";

/**
 * Score-assist inputs: the club type ScoreAssistFlow needs for its copy, and
 * the pool of works the current user has already scored (minus the target) —
 * drawn from this club's cached reviews plus their scores in every other club
 * they belong to. ScoreEntryModal and ScoreEntryDock each host the assist flow
 * inline and share this derivation.
 */
export function useScoreAssistCandidates(targetWorkId: MaybeRefOrGetter<string>) {
  const clubSlug = useClubSlug();
  const { data: club } = useClub(clubSlug);
  const { data: reviews } = useReviewsList(clubSlug);
  const { data: memberScores } = useMemberScores();
  const user = useUser();

  const clubType = computed(() => club.value?.type ?? ClubType.movie);
  const candidates = computed(() =>
    hasValue(user.value?.id)
      ? buildCandidatePool(
          reviews.value ?? [],
          user.value.id,
          toValue(targetWorkId),
          memberScores.value ?? [],
        )
      : [],
  );

  return { clubType, candidates };
}
