<template>
  <div class="flex flex-col items-center gap-4 text-center">
    <template v-if="isDefined(pivot)">
      <div class="flex flex-col gap-1">
        <h2 class="text-xl font-bold">Which {{ noun }} did you like more?</h2>
        <p class="text-sm text-gray-400">Tap the one you liked more</p>
      </div>
      <div class="flex justify-center gap-4">
        <button
          type="button"
          class="w-40 rounded-lg transition duration-fast ease-standard hover:scale-[1.03] hover:ring-4 hover:ring-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary active:scale-[0.98]"
          :aria-label="`I liked ${target.title} more`"
          @click="answer('more')"
        >
          <WorkPosterCard :title="target.title" :poster-url="targetPosterUrl" />
        </button>
        <Transition name="pivot-swap" mode="out-in">
          <button
            :key="pivot.workId"
            type="button"
            class="w-40 rounded-lg transition duration-fast ease-standard hover:scale-[1.03] hover:ring-4 hover:ring-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary active:scale-[0.98]"
            :aria-label="`I liked ${pivot.title} more`"
            @click="answer('less')"
          >
            <WorkPosterCard :title="pivot.title" :poster-url="pivotPosterUrl" />
          </button>
        </Transition>
      </div>
      <div class="flex items-center gap-4">
        <button
          class="rounded-full bg-lowBackground px-4 py-1.5 text-sm text-gray-300 transition hover:brightness-110"
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

import { isDefined } from "../../../../lib/checks/checks.js";
import { ClubType } from "../../../../lib/types/generated/db";
import { DetailedReviewListItem } from "../../../../lib/types/lists";
import { ComparisonAnswer, ScoredCandidate } from "../composables/scoreAssistLogic";
import { useScoreAssist } from "../composables/useScoreAssist";
import { formatScore } from "../scoreScale";
import { clubTypeConfig } from "@/common/clubType";
import WorkPosterCard from "@/common/components/WorkPosterCard.vue";
import { workPosterUrl } from "@/common/workDisplay";

// Content-only: the comparison flow with no overlay of its own, so hosts can
// swap it into whatever surface is already open (ScoreEntryModal and the
// drawer's ScoreEntryDock replace their dial with this; ScoreAssistModal
// wraps it in a fresh v-modal) instead of stacking a second modal/sheet on
// top.
const props = defineProps<{
  target: DetailedReviewListItem;
  candidates: ScoredCandidate[];
  clubType: ClubType;
}>();

const emit = defineEmits<{
  // Fired the moment the session converges on a suggestion. Nothing is
  // persisted here: the host pre-fills its score input with the value and
  // leaves saving to the user.
  (e: "suggest", score: number): void;
}>();

const {
  pivot,
  result,
  answer: answerSession,
  progressLabel,
} = useScoreAssist(props.target, props.candidates);

const noun = computed(() => clubTypeConfig(props.clubType).noun);

const targetPosterUrl = computed(
  () => workPosterUrl(props.target.externalData, props.target.imageUrl) ?? "",
);
const pivotPosterUrl = computed(() =>
  isDefined(pivot.value)
    ? (workPosterUrl(pivot.value.externalData, pivot.value.imageUrl) ?? "")
    : "",
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
