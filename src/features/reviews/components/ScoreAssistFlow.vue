<template>
  <div class="flex flex-col items-center gap-4 text-center">
    <template v-if="isDefined(pivot)">
      <div class="flex flex-col gap-1">
        <h2 class="text-xl font-bold">{{ question }}</h2>
        <p class="text-sm text-gray-400">Tap the one you liked more</p>
      </div>
      <div class="flex justify-center gap-4">
        <button
          type="button"
          class="duration-fast ease-standard hover:ring-primary focus-visible:ring-primary w-40 rounded-lg transition hover:scale-[1.03] hover:ring-4 focus-visible:ring-4 focus-visible:outline-none active:scale-[0.98]"
          :aria-label="`I liked ${targetTitle} more`"
          @click="answer('more')"
        >
          <WorkPosterCard
            :title="targetTitle"
            :poster-url="targetImage.url"
            :landscape="targetImage.landscape"
          />
        </button>
        <Transition name="pivot-swap" mode="out-in">
          <button
            :key="pivot.workId"
            type="button"
            class="duration-fast ease-standard hover:ring-primary focus-visible:ring-primary w-40 rounded-lg transition hover:scale-[1.03] hover:ring-4 focus-visible:ring-4 focus-visible:outline-none active:scale-[0.98]"
            :aria-label="`I liked ${workTitle(pivot)} more`"
            @click="answer('less')"
          >
            <WorkPosterCard
              :title="workTitle(pivot)"
              :poster-url="pivotImage.url"
              :landscape="pivotImage.landscape"
            >
              <!-- The pool spans every club the user belongs to, so a pivot
                   they scored elsewhere says where it came from. Clubs can
                   share a name, so the comparison is by id. -->
              <span v-if="isFromAnotherClub" class="text-xs text-gray-400">
                from {{ pivot.clubName }}
              </span>
            </WorkPosterCard>
          </button>
        </Transition>
      </div>
      <div class="flex items-center gap-4">
        <button
          class="bg-lowBackground rounded-full px-4 py-1.5 text-sm text-gray-300 transition hover:brightness-110"
          @click="answer('same')"
        >
          Too close to call
        </button>
        <button
          class="text-sm text-gray-400 underline-offset-2 hover:underline"
          @click="answer('skip')"
        >
          Skip this one
        </button>
      </div>
      <span class="text-xs text-gray-400">{{ progressLabel }}</span>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useToast } from "vue-toastification";

import { hasValue, isDefined } from "../../../../lib/checks/checks.js";
import { type ClubType } from "../../../../lib/types/generated/db";
import { type DetailedReviewListItem, type WorkDataSummary } from "../../../../lib/types/lists";
import { type ComparisonAnswer, type ScoredCandidate } from "../composables/scoreAssistLogic";
import { useScoreAssist } from "../composables/useScoreAssist";
import { formatScore } from "../scoreScale";
import { clubTypeConfig, workNoun, workStillUrl, workTitle } from "@/common/clubType";
import WorkPosterCard from "@/common/components/WorkPosterCard.vue";
import { workPosterUrl } from "@/common/workDisplay";

// Content-only: the comparison flow with no overlay of its own, so hosts can
// swap it into whatever surface is already open (ScoreEntryModal and the
// drawer's ScoreEntryDock replace their dial with this; ScoreAssistModal
// wraps it in a fresh v-modal) instead of stacking a second modal/sheet on
// top.
const {
  target,
  candidates,
  clubType,
  currentClubId = undefined,
} = defineProps<{
  target: DetailedReviewListItem;
  candidates: ScoredCandidate[];
  clubType: ClubType;
  /** The club being reviewed in; its own works need no "from ..." label. */
  currentClubId?: string;
}>();

const emit = defineEmits<{
  // Fired the moment the session converges on a suggestion. Nothing is
  // persisted here: the host pre-fills its score input with the value and
  // leaves saving to the user.
  (e: "suggest", score: number): void;
}>();

const { pivot, result, answer: answerSession, progressLabel } = useScoreAssist(target, candidates);

const targetTitle = computed(() => workTitle(target));

// Candidates are always the club's own unit (an episode, for TV), so a target
// at another level — a show — is compared without naming either.
const question = computed(() => {
  const noun = clubTypeConfig(clubType).noun;
  const targetNoun = workNoun(target.externalData) ?? noun;
  return targetNoun === noun ? `Which ${noun} did you like more?` : "Which did you like more?";
});

// Every episode of a show shares its poster, so an episode is shown by its
// own still: two posters side by side would be indistinguishable.
const cardImage = (work: { imageUrl?: string; externalData?: WorkDataSummary }) => {
  const still = workStillUrl(work.externalData);
  return isDefined(still)
    ? { url: still, landscape: true }
    : { url: workPosterUrl(work.externalData, work.imageUrl) ?? "", landscape: false };
};

const targetImage = computed(() => cardImage(target));
const pivotImage = computed(() =>
  isDefined(pivot.value) ? cardImage(pivot.value) : { url: "", landscape: false },
);
const isFromAnotherClub = computed(
  () => isDefined(pivot.value) && hasValue(currentClubId) && pivot.value.clubId !== currentClubId,
);

const toast = useToast();

// No result screen: the moment the session converges, announce the picked
// score in a toast and hand it to the host, which pre-fills its score input
// so the user can save it (or tweak it first) themselves.
const answer = (choice: ComparisonAnswer) => {
  answerSession(choice);
  const outcome = result.value;
  if (!isDefined(outcome)) return;
  const score = outcome.suggestedScore;
  toast.success(`We picked ${formatScore(score)}/10`);
  emit("suggest", score);
};
</script>

<style scoped>
.pivot-swap-enter-active,
.pivot-swap-leave-active {
  transition:
    opacity 150ms ease,
    transform 150ms ease;
}

.pivot-swap-enter-from {
  opacity: 0;
  transform: translateX(0.5rem);
}

.pivot-swap-leave-to {
  opacity: 0;
  transform: translateX(-0.5rem);
}

@media (prefers-reduced-motion: reduce) {
  .pivot-swap-enter-active,
  .pivot-swap-leave-active {
    transition: none;
  }
}
</style>
