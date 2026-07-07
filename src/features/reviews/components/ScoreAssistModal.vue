<template>
  <v-modal size="sm" z-index="60" @close="emit('close')">
    <div class="flex flex-col items-center gap-4 text-center">
      <template v-if="isDefined(pivot)">
        <h2 class="text-xl font-bold">Which {{ noun }} did you like more?</h2>
        <div class="flex justify-center gap-4">
          <div class="flex w-40 flex-col gap-2">
            <WorkPosterCard
              :title="target.title"
              :poster-url="targetPosterUrl"
              selectable
              @select="answer('more')"
            />
            <v-btn
              class="w-full"
              :aria-label="`I liked ${target.title} more`"
              @click="answer('more')"
            >
              This one
            </v-btn>
          </div>
          <Transition name="pivot-swap" mode="out-in">
            <div :key="pivot.workId" class="flex w-40 flex-col gap-2">
              <WorkPosterCard
                :title="pivot.title"
                :poster-url="pivotPosterUrl"
                selectable
                @select="answer('less')"
              />
              <v-btn
                class="w-full"
                :aria-label="`I liked ${pivot.title} more`"
                @click="answer('less')"
              >
                This one
              </v-btn>
            </div>
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

      <template v-else-if="isDefined(result)">
        <h2 class="text-xl font-bold">Our suggestion for {{ target.title }}</h2>
        <p class="text-sm text-gray-300">{{ contextLine }}</p>
        <div class="flex items-end justify-center gap-1">
          <input
            v-model="scoreModel"
            type="number"
            inputmode="decimal"
            min="0"
            max="10"
            step="any"
            aria-label="Score"
            class="w-24 rounded-lg border border-gray-300 bg-background p-2 text-center text-3xl font-bold outline-none [appearance:textfield] focus:border-primary [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            @keydown.enter="save"
          />
          <span class="pb-2 text-sm text-gray-400">/10</span>
        </div>
        <div class="flex items-center gap-4">
          <v-btn @click="save">Save score</v-btn>
          <button
            class="text-sm text-gray-400 underline-offset-2 hover:underline"
            @click="startOver"
          >
            Start over
          </button>
        </div>
      </template>
    </div>
  </v-modal>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

import { hasValue, isDefined } from "../../../../lib/checks/checks.js";
import { ClubType } from "../../../../lib/types/generated/db";
import { DetailedReviewListItem } from "../../../../lib/types/lists";
import { ScoredCandidate } from "../composables/scoreAssistLogic";
import { useScoreAssist } from "../composables/useScoreAssist";

import { clubTypeConfig } from "@/common/clubType";
import WorkPosterCard from "@/common/components/WorkPosterCard.vue";
import { workPosterUrl } from "@/common/workDisplay";
import { useClubSlug } from "@/service/useClub";
import { useReviewWork, useUpdateReviewScore } from "@/service/useReviews";
import { useUser } from "@/service/useUser";

const props = defineProps<{
  target: DetailedReviewListItem;
  candidates: ScoredCandidate[];
  clubType: ClubType;
}>();

const emit = defineEmits<{
  (e: "close"): void;
}>();

const { pivot, result, answer, restart, progressLabel } = useScoreAssist(
  props.target,
  props.candidates,
);

const noun = computed(() => clubTypeConfig(props.clubType).noun);

const targetPosterUrl = computed(
  () => workPosterUrl(props.target.externalData, props.target.imageUrl) ?? "",
);
const pivotPosterUrl = computed(() =>
  isDefined(pivot.value)
    ? (workPosterUrl(pivot.value.externalData, pivot.value.imageUrl) ?? "")
    : "",
);

// Reference scores are shown as the user entered them (only the suggestion is
// rounded to halves), trimmed like ReviewView's table cells.
const formatScore = (score: number) => String(Math.round(score * 100) / 100);

const contextLine = computed(() => {
  const current = result.value;
  if (!isDefined(current)) return "";
  switch (current.kind) {
    case "matched":
      return isDefined(current.matchedWork)
        ? `About the same as ${current.matchedWork.title} (${formatScore(current.matchedWork.score)}).`
        : "";
    case "aboveAll":
      return isDefined(current.lowerWork)
        ? `Higher than ${current.lowerWork.title} (${formatScore(current.lowerWork.score)}) — your top-rated ${noun.value} so far.`
        : "";
    case "belowAll":
      return isDefined(current.upperWork)
        ? `Lower than ${current.upperWork.title} (${formatScore(current.upperWork.score)}) — your lowest-rated ${noun.value} so far.`
        : "";
    case "converged": {
      const { lowerWork, upperWork } = current;
      if (isDefined(lowerWork) && isDefined(upperWork)) {
        return `You liked it more than ${lowerWork.title} (${formatScore(lowerWork.score)}) but less than ${upperWork.title} (${formatScore(upperWork.score)}).`;
      }
      if (isDefined(lowerWork)) {
        return `You liked it more than ${lowerWork.title} (${formatScore(lowerWork.score)}).`;
      }
      if (isDefined(upperWork)) {
        return `You liked it less than ${upperWork.title} (${formatScore(upperWork.score)}).`;
      }
      return "Adjust it if that doesn't feel right.";
    }
  }
  // Unreachable - the switch above is exhaustive over ScoreAssistResult.kind -
  // but vue/return-in-computed-property can't tell.
  return "";
});

// The input prefills with the suggestion but stays editable; the override ref
// (instead of a watcher) keeps the user's edits once they start typing.
const editedScore = ref<string>();
const scoreModel = computed({
  get: () => editedScore.value ?? String(result.value?.suggestedScore ?? ""),
  set: (value: string) => {
    editedScore.value = value;
  },
});

const startOver = () => {
  editedScore.value = undefined;
  restart();
};

const clubSlug = useClubSlug();
const user = useUser();
const { mutate: submit } = useReviewWork(clubSlug);
const { mutate: update } = useUpdateReviewScore(clubSlug);

const save = () => {
  const score = Number.parseFloat(scoreModel.value);
  if (Number.isNaN(score) || score < 0 || score > 10) return;
  const reviewId = isDefined(user.value)
    ? props.target.scores[user.value.id]?.id
    : undefined;
  if (hasValue(reviewId)) {
    update({ reviewId, score });
  } else {
    submit({ workId: props.target.id, score });
  }
  emit("close");
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
