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
  <input
    v-else-if="isMe && isInputOpen"
    ref="scoreInput"
    v-model="scoreModel"
    aria-label="Score"
    class="w-10 rounded-lg border border-gray-300 bg-background p-2 text-center outline-none focus:border-primary"
    @blur="isInputOpen = false"
    @keypress.enter="submitScore(parseFloat(scoreModel))"
  />
</template>
<script setup lang="ts">
import { computed, nextTick, ref } from "vue";

import { useClubId } from "@/service/useClub";
import { useReviewWork, useUpdateReviewScore } from "@/service/useReviews";
import { useUser } from "@/service/useUser";

const props = defineProps<{
  memberId: string;
  workId: string;
  score?: number;
  reviewId?: string;
}>();

const { data: user } = useUser();
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
  });
};

const clubId = useClubId();
const { mutate: submit } = useReviewWork(clubId);
const { mutate: update } = useUpdateReviewScore(clubId);

const submitScore = (score: number) => {
  if (!isNaN(score) && score >= 0 && score <= 10) {
    if (props.reviewId) {
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
</script>
