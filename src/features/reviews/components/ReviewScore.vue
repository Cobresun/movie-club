<template>
  <span
    v-if="isDefined(score) && !isInputOpen"
    :class="{
      'cursor-pointer': isMe,
    }"
    @click.stop="openScoreInput"
  >
    {{ score }}
  </span>
  <span
    v-else-if="isMe && !isInputOpen"
    role="button"
    aria-label="Add score"
    class="flex cursor-pointer items-center justify-center gap-0.5"
    @click.stop="openScoreInput"
  >
    <mdicon name="plus" />
    <span class="text-xs text-gray-400">/10</span>
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
      :class="{ 'w-10 p-2': size !== 'sm', 'w-8': size === 'sm' }"
      @blur="submitScore(parseFloat(scoreModel))"
      @keydown.enter="scoreInput?.blur()"
    />
    <span class="text-xs text-gray-400">/10</span>
  </span>
</template>
<script setup lang="ts">
import { computed, nextTick, ref } from "vue";

import { hasValue, isDefined } from "../../../../lib/checks/checks.js";

import { useClubSlug } from "@/service/useClub";
import { useReviewWork, useUpdateReviewScore } from "@/service/useReviews";
import { useUser } from "@/service/useUser";

const props = defineProps<{
  memberId: string;
  workId: string;
  score?: number;
  reviewId?: string;
  size?: string;
}>();

const user = useUser();
const isMe = computed(() => user.value?.id === props.memberId);

const isInputOpen = ref(false);
const scoreModel = ref("");
const scoreInput = ref<HTMLInputElement | null>(null);

const openScoreInput = () => {
  if (!isMe.value) return;
  isInputOpen.value = true;
  scoreModel.value = props.score?.toString() ?? "";
  nextTick(() => {
    scoreInput.value?.focus();
    scoreInput.value?.select();
  }).catch(console.error);
};

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
