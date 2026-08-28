import { computed, MaybeRefOrGetter, toValue } from "vue";

import { ClubType } from "../../../../lib/types/generated/db";
import { buildCandidatePool, ScoreAssistTarget } from "./scoreAssistLogic";
import { useClub, useClubSlug } from "@/service/useClub";
import { useMemberScores } from "@/service/useUser";

/**
 * Score-assist inputs: the club type and id ScoreAssistFlow needs for its copy
 * and club labels, and the pool of works the current user has already scored
 * (minus the target) across every club they belong to. ScoreEntryModal and
 * ScoreEntryDock each host the assist flow inline and share this derivation.
 */
export function useScoreAssistCandidates(target: MaybeRefOrGetter<ScoreAssistTarget>) {
  const clubSlug = useClubSlug();
  const { data: club } = useClub(clubSlug);
  const { data: memberScores } = useMemberScores();

  const clubType = computed(() => club.value?.type ?? ClubType.movie);
  const clubId = computed(() => club.value?.clubId);
  const candidates = computed(() => buildCandidatePool(memberScores.value ?? [], toValue(target)));

  return { clubType, clubId, candidates };
}
