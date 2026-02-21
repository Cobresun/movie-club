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
    class="flex cursor-pointer justify-center"
    @click.stop="openScoreInput"
  >
    <mdicon name="plus" />
  </span>
  <input
    v-else-if="isMe && isInputOpen"
    ref="scoreInput"
    v-model="scoreModel"
    aria-label="Score"
    class="rounded-lg border border-gray-300 bg-background text-center outline-none focus:border-primary"
    :class="{ 'w-10 p-2': size !== 'sm', 'w-8': size === 'sm' }"
    @blur="handleBlur"
    @keypress.enter="handleKeyEnter"
  />
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
  if (!isNaN(score) && score >= 0 && score <= 10) {
    if (hasValue(props.reviewId)) {
      update({ reviewId: props.reviewId, score });
    } else {
      submit({
        workId: props.workId,
        score,
      });
    }
    isInputOpen.value = false;
  }
};

// Track whether Enter was pressed so we don't double-submit on the blur
// event that fires when the input is removed from the DOM after Enter.
const submittedViaKeyboard = ref(false);

const handleKeyEnter = () => {
  submittedViaKeyboard.value = true;
  submitScore(parseFloat(scoreModel.value));
};

// On iOS, tapping "Done" on the keyboard only fires a blur event, not a
// keypress event, so we also attempt to submit here. The submittedViaKeyboard
// flag prevents a double submission when Enter is used on desktop/physical
// keyboards (which removes the input from the DOM and triggers blur).
const handleBlur = () => {
  if (!submittedViaKeyboard.value) {
    submitScore(parseFloat(scoreModel.value));
  }
  submittedViaKeyboard.value = false;
  isInputOpen.value = false;
};
</script>
