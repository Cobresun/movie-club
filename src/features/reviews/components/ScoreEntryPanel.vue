<template>
  <div class="flex flex-col items-center gap-3">
    <!-- Arc-gauge slider snapping to SCORE_STEP; its center input still takes
         precise decimals typed by hand. Drag and type share `scoreModel`. -->
    <ScoreDial ref="scoreDial" v-model="scoreModel" @save="save" />

    <button
      v-if="showAssist"
      type="button"
      class="flex items-center gap-2 rounded-full bg-lowBackground px-4 py-1.5 text-sm text-gray-300 transition hover:brightness-110"
      @click="openAssist"
    >
      <mdicon name="scale-balance" size="16" />
      <span>Compare {{ noun }}s you've rated</span>
    </button>

    <!-- Styled to mirror the drawer's "Rate this ..." CTA (rounded-lg, py-3)
         so the footer button keeps one consistent size/shape across the
         collapsed and expanded states. -->
    <button
      type="button"
      :disabled="!canSave"
      class="w-full rounded-lg py-3 text-center font-bold tracking-wide text-text transition duration-fast ease-standard"
      :class="
        canSave
          ? 'bg-primary hover:brightness-110 active:scale-[0.98]'
          : 'bg-gray-600'
      "
      @click="save"
    >
      Save score
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
import { clampScore, isValidScore } from "../scoreScale";
import ScoreDial from "./ScoreDial.vue";

import { clubTypeConfig } from "@/common/clubType";
import { useClub, useClubSlug } from "@/service/useClub";
import { useSubmitScore } from "@/service/useReviews";

const props = defineProps<{
  workId: string;
  score?: number;
  reviewId?: string;
  // When true, focus (and scroll to) the field once mounted. The table popover
  // uses this immediately; the drawer's ScoreEntryDock sets `autofocusDelay`
  // so focus waits for its expansion to finish rather than scrolling
  // mid-transition.
  autofocus?: boolean;
  autofocusDelay?: number;
}>();

const emit = defineEmits<{
  (e: "submit"): void;
  // The user tapped "Not sure?". The panel only gates the button (via the
  // injected eligibility check); the host decides how to present the assist
  // flow — an already-open overlay swaps ScoreAssistFlow into itself, while
  // non-overlay hosts open the standalone ScoreAssistModal.
  (e: "assist"): void;
}>();

const clubSlug = useClubSlug();
const { data: club } = useClub(clubSlug);
const noun = computed(
  () => clubTypeConfig(club.value?.type ?? ClubType.movie).noun,
);

const scoreModel = ref(props.score?.toString() ?? "");

// Typed by the dial's exposed surface rather than InstanceType<typeof ScoreDial>:
// ESLint's type-aware program cannot resolve .vue module types, so the latter
// collapses to `any` under lint even though vue-tsc resolves it fine.
interface ScoreDialExposed {
  focusInput: () => void;
}
const scoreDial = ref<ScoreDialExposed | null>(null);

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
  // Typed input allows arbitrary decimals; persist at most two, matching the
  // precision every score display rounds to (formatScore).
  const clamped = clampScore(Math.round(score * 100) / 100);
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
  emit("assist");
};

let autofocusTimer: ReturnType<typeof setTimeout> | undefined;

onMounted(() => {
  if (!isTrue(props.autofocus)) return;
  const focus = () =>
    nextTick(() => {
      scoreDial.value?.focusInput();
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
