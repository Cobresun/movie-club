<template>
  <div class="flex flex-col items-center gap-3">
    <!--
      Slider slot (deferred): a 0-10 `<input type="range">` snapping to
      SCORE_STEP will live here, bound to the same `scoreModel` as the field
      below so drag and type stay in sync. Scaffolded intentionally — the scale
      constants and layout are ready; only the control itself is pending.
    -->

    <div class="flex items-end justify-center gap-1">
      <input
        ref="scoreInput"
        v-model="scoreModel"
        type="number"
        inputmode="decimal"
        :min="SCORE_MIN"
        :max="SCORE_MAX"
        step="any"
        placeholder="8.5"
        aria-label="Score"
        class="w-24 rounded-lg border border-gray-300 bg-background p-2 text-center text-2xl font-bold outline-none [appearance:textfield] focus:border-primary [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        @keydown.enter="save"
      />
      <span class="pb-2 text-sm text-gray-400">/{{ SCORE_MAX }}</span>
    </div>

    <v-btn :disabled="!canSave" @click="save">Save score</v-btn>

    <button
      v-if="showAssist"
      type="button"
      class="flex items-center gap-2 rounded-full bg-lowBackground px-4 py-1.5 text-sm text-gray-300 transition hover:brightness-110"
      @click="openAssist"
    >
      <mdicon name="scale-balance" size="16" />
      <span>Not sure? Compare {{ noun }}s you've rated</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  inject,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";

import { isDefined, isTrue } from "../../../../lib/checks/checks.js";
import { ClubType } from "../../../../lib/types/generated/db";
import { ScoreAssistKey } from "../scoreAssist";
import { clampScore, isValidScore, SCORE_MAX, SCORE_MIN } from "../scoreScale";

import { clubTypeConfig } from "@/common/clubType";
import { useClub, useClubSlug } from "@/service/useClub";
import { useSubmitScore } from "@/service/useReviews";

const props = defineProps<{
  workId: string;
  score?: number;
  reviewId?: string;
  // When true, focus (and scroll to) the field once mounted. The table popover
  // uses this immediately; the drawer sets `autofocusDelay` so focus waits for
  // the slide-in to finish rather than scrolling mid-transition.
  autofocus?: boolean;
  autofocusDelay?: number;
}>();

const emit = defineEmits<{
  (e: "submit"): void;
}>();

const clubSlug = useClubSlug();
const { data: club } = useClub(clubSlug);
const noun = computed(
  () => clubTypeConfig(club.value?.type ?? ClubType.movie).noun,
);

const scoreModel = ref(props.score?.toString() ?? "");
const scoreInput = ref<HTMLInputElement | null>(null);

// Re-seed the field when the score changes out from under us — e.g. after Score
// Assist saves a suggestion and the drawer reappears. `scoreModel` is seeded
// from `props.score` only at mount, so this keeps it in sync without re-keying
// the panel (a remount would re-run onMounted and wrongly re-fire autofocus).
// The drawer has no second writer of the current user's score, so replacing the
// draft on every change is always correct and never discards real in-progress
// typing.
watch(
  () => props.score,
  (score) => {
    scoreModel.value = score?.toString() ?? "";
  },
);

const canSave = computed(() =>
  isValidScore(Number.parseFloat(scoreModel.value)),
);

const scoreAssist = inject(ScoreAssistKey, undefined);
const showAssist = computed(
  () => isDefined(scoreAssist) && scoreAssist.isEligible(props.workId),
);

const submitScore = useSubmitScore(clubSlug);

const save = () => {
  const score = Number.parseFloat(scoreModel.value);
  if (!isValidScore(score)) return;
  const clamped = clampScore(score);
  if (clamped !== props.score) {
    submitScore({
      workId: props.workId,
      reviewId: props.reviewId,
      score: clamped,
    });
  }
  emit("submit");
};

const openAssist = () => {
  scoreAssist?.open(props.workId);
  emit("submit");
};

let autofocusTimer: ReturnType<typeof setTimeout> | undefined;

onMounted(() => {
  if (!isTrue(props.autofocus)) return;
  const focus = () =>
    nextTick(() => {
      scoreInput.value?.focus();
      scoreInput.value?.select();
    }).catch(console.error);
  const delay = props.autofocusDelay ?? 0;
  if (delay > 0) {
    autofocusTimer = setTimeout(() => void focus(), delay);
  } else {
    void focus();
  }
});

onBeforeUnmount(() => {
  if (isDefined(autofocusTimer)) clearTimeout(autofocusTimer);
});
</script>
