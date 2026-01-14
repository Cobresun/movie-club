<template>
  <span
    v-if="score && !isInputOpen"
    :class="{
      'cursor-pointer': isMe,
    }"
    @click="openScoreInput"
  >
    {{ score }}
  </span>
  <span
    v-else-if="isMe && !isInputOpen"
    role="button"
    aria-label="Add score"
    class="flex cursor-pointer justify-center"
    @click="openScoreInput"
  >
    <mdicon name="plus" />
  </span>
  <form
    ref="scoreForm"
    v-else-if="isMe && isInputOpen"
    @submit.prevent="submitScore(parseFloat(scoreModel))"
  >
    <input
      ref="scoreInput"
      v-model="scoreModel"
      type="number"
      step="any"
      inputmode="decimal"
      enterkeyhint="go"
      aria-label="Score"
      class="rounded-lg border border-gray-300 bg-background text-center outline-none focus:border-primary"
      :class="{ 'w-10 p-2': size !== 'sm', 'w-8': size === 'sm' }"
      @blur="handleBlur"
      @keydown.enter="handleEnter"
    />
  </form>
</template>
<script setup lang="ts">
import { computed, nextTick, ref } from "vue";

import { hasValue } from "../../../../lib/checks/checks.js";

import { useClubId } from "@/service/useClub";
import { useReviewWork, useUpdateReviewScore } from "@/service/useReviews";
import { useUser } from "@/service/useUser";

const props = defineProps<{
  memberId: string;
  workId: string;
  score?: number;
  reviewId?: string;
  size?: string;
}>();

const { data: user } = useUser();
const isMe = computed(() => user.value?.id === props.memberId);

const isInputOpen = ref(false);
const scoreModel = ref("");
const scoreInput = ref<HTMLInputElement | null>(null);
const scoreForm = ref<HTMLFormElement | null>(null);
const isSubmitting = ref(false);

const openScoreInput = () => {
  if (!isMe.value) return;
  isInputOpen.value = true;
  scoreModel.value = props.score?.toString() ?? "";
  nextTick(() => {
    scoreInput.value?.focus();
    scoreInput.value?.select();
  }).catch(console.error);
};

const handleEnter = (e: KeyboardEvent) => {
  e.preventDefault();
  // Trigger form submission programmatically for test environments
  // Real browsers will handle this naturally, but this ensures compatibility
  scoreForm.value?.requestSubmit();
};

const clubId = useClubId();
const { mutate: submit } = useReviewWork(clubId);
const { mutate: update } = useUpdateReviewScore(clubId);

const submitScore = (score: number) => {
  if (!isNaN(score) && score >= 0 && score <= 10) {
    isSubmitting.value = true;
    if (hasValue(props.reviewId)) {
      update({ reviewId: props.reviewId, score });
    } else {
      submit({
        workId: props.workId,
        score,
      });
    }
    isInputOpen.value = false;
    isSubmitting.value = false;
  }
};

const handleBlur = () => {
  // Delay closing to allow form submission to complete
  setTimeout(() => {
    if (!isSubmitting.value) {
      isInputOpen.value = false;
    }
  }, 100);
};
</script>
