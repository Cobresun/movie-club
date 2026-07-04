<template>
  <span
    v-if="isDefined(score) && !isInputOpen"
    :class="{
      'cursor-pointer': isMe,
    }"
    @click.stop="handleScoreClick"
  >
    {{ score }}
  </span>
  <span
    v-else-if="isMe && !isInputOpen"
    role="button"
    aria-label="Add score"
    class="flex cursor-pointer items-center justify-center gap-0.5"
    @click.stop="handleScoreClick"
  >
    <mdicon name="plus" />
    <span v-if="openInDrawer !== true" class="text-xs text-gray-400">/10</span>
  </span>
  <span
    v-else-if="isMe && isInputOpen"
    class="inline-flex items-center gap-0.5"
  >
    <input
      ref="scoreInput"
      v-model="scoreModel"
      type="number"
      inputmode="decimal"
      min="0"
      max="10"
      step="any"
      placeholder="8.5"
      aria-label="Score"
      class="rounded-lg border border-gray-300 bg-background text-center outline-none [appearance:textfield] focus:border-primary [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      :class="{
        'w-10 p-2': size !== 'sm',
        'w-8': size === 'sm',
        'animate-score-pop': drawAttention,
      }"
      @blur="submitScore(parseFloat(scoreModel))"
      @keydown.enter="scoreInput?.blur()"
      @animationend="drawAttention = false"
    />
    <span class="text-xs text-gray-400">/10</span>
  </span>
</template>
<script setup lang="ts">
import {
  computed,
  inject,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
} from "vue";

import { hasValue, isDefined, isTrue } from "../../../../lib/checks/checks.js";
import { RequestScoreEntryKey } from "../scoreEntry";

import { useClubSlug } from "@/service/useClub";
import { useReviewWork, useUpdateReviewScore } from "@/service/useReviews";
import { useUser } from "@/service/useUser";

const props = defineProps<{
  memberId: string;
  workId: string;
  score?: number;
  reviewId?: string;
  size?: string;
  // When true (poster chips in the gallery), clicking defers score entry to the
  // details drawer instead of opening a cramped inline input on the poster.
  openInDrawer?: boolean;
  // When true (the current user's field inside the drawer), open the input and
  // focus it as soon as the drawer mounts.
  autoFocus?: boolean;
}>();

const user = useUser();
const isMe = computed(() => user.value?.id === props.memberId);

const isInputOpen = ref(false);
const scoreModel = ref("");
const scoreInput = ref<HTMLInputElement | null>(null);
// Plays a one-shot bounce on the input to draw the eye when it's opened for the
// user (rather than by their own tap), e.g. auto-focused inside the drawer.
const drawAttention = ref(false);

const requestScoreEntry = inject(RequestScoreEntryKey, undefined);

const handleScoreClick = () => {
  if (!isMe.value) return;
  if (isTrue(props.openInDrawer) && isDefined(requestScoreEntry)) {
    requestScoreEntry(props.workId);
    return;
  }
  openScoreInput();
};

const openScoreInput = ({ animate = false }: { animate?: boolean } = {}) => {
  if (!isMe.value) return;
  drawAttention.value = animate;
  isInputOpen.value = true;
  scoreModel.value = props.score?.toString() ?? "";
  nextTick(() => {
    scoreInput.value?.focus();
    scoreInput.value?.select();
  }).catch(console.error);
};

// Let the drawer / bottom-sheet slide-in animation (200ms sheet, 280ms drawer)
// finish before opening and focusing the input, so it doesn't pop and scroll
// into view mid-transition.
const AUTOFOCUS_DELAY_MS = 300;
let autoFocusTimer: ReturnType<typeof setTimeout> | undefined;

onMounted(() => {
  if (isTrue(props.autoFocus) && isMe.value) {
    autoFocusTimer = setTimeout(
      () => openScoreInput({ animate: true }),
      AUTOFOCUS_DELAY_MS,
    );
  }
});

onBeforeUnmount(() => {
  if (isDefined(autoFocusTimer)) {
    clearTimeout(autoFocusTimer);
  }
});

const clubId = useClubSlug();
const { mutate: submit } = useReviewWork(clubId);
const { mutate: update } = useUpdateReviewScore(clubId);

const submitScore = (score: number) => {
  if (!isNaN(score) && score >= 0 && score <= 10 && score !== props.score) {
    if (hasValue(props.reviewId)) {
      update({ reviewId: props.reviewId, score });
    } else {
      submit({
        workId: props.workId,
        score,
      });
    }
  }
  isInputOpen.value = false;
};
</script>

<style scoped>
@keyframes score-pop {
  0% {
    transform: scale(1);
  }
  35% {
    transform: scale(1.18);
  }
  70% {
    transform: scale(0.96);
  }
  100% {
    transform: scale(1);
  }
}

.animate-score-pop {
  animation: score-pop 0.45s ease-in-out;
}

@media (prefers-reduced-motion: reduce) {
  .animate-score-pop {
    animation: none;
  }
}
</style>
