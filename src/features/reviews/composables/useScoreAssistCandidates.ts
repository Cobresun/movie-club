import { computed, MaybeRefOrGetter, toValue } from "vue";

import { hasValue } from "../../../../lib/checks/checks.js";
import { ClubType } from "../../../../lib/types/generated/db";
import { buildCandidatePool } from "./scoreAssistLogic";
import { useClub, useClubSlug } from "@/service/useClub";
import { useReviewsList } from "@/service/useList";
import { useUser } from "@/service/useUser";

/**
 * Score-assist inputs derived from the cached reviews query: the club type
 * ScoreAssistFlow needs for its copy, and the pool of works the current user
 * has already scored (minus the target). ScoreEntryModal and ScoreEntryDock
 * each host the assist flow inline and previously duplicated this exact
 * derivation.
 */
export function useScoreAssistCandidates(targetWorkId: MaybeRefOrGetter<string>) {
  const clubSlug = useClubSlug();
  const { data: club } = useClub(clubSlug);
  const { data: reviews } = useReviewsList(clubSlug);
  const user = useUser();

  const clubType = computed(() => club.value?.type ?? ClubType.movie);
  const candidates = computed(() =>
    hasValue(user.value?.id)
      ? buildCandidatePool(reviews.value ?? [], user.value.id, toValue(targetWorkId))
      : [],
  );

  return { clubType, candidates };
}
