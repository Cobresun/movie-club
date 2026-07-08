<template>
  <div class="mb-2 flex justify-between">
    <h3 class="text-left text-xl font-bold">{{ award.title }}</h3>
    <v-btn v-show="!showResult" @click="revealResult">Reveal</v-btn>
  </div>
  <transition-group
    tag="div"
    enter-from-class="h-0"
    enter-active-class="transition-[height] ease-linear duration-500 overflow-hidden"
    enter-to-class="h-96"
  >
    <div
      v-if="showResult"
      class="grid grid-cols-auto justify-items-center gap-4"
    >
      <WorkPosterCard
        v-for="nomination in nominationsWithScore"
        :key="nomination.movieId"
        :title="nomination.movieTitle"
        :poster-url="nomination.posterUrl"
        :highlighted="nomination.score === maxScore"
      >
        <div class="grid grid-cols-2 gap-2">
          <div
            v-for="member in members"
            :key="member.id"
            class="flex items-center rounded-3xl bg-lowBackground"
          >
            <v-avatar :size="32" :name="member.name" :src="member.image" />
            <div class="flex-grow text-sm">
              {{ nomination.ranking[member.id] }}
            </div>
          </div>
        </div>
      </WorkPosterCard>
    </div></transition-group
  >
</template>
<script setup lang="ts">
import { computed, ref } from "vue";

import { Award, AwardsStep } from "../../../../lib/types/awards";
import { Member } from "../../../../lib/types/club";

import WorkPosterCard from "@/common/components/WorkPosterCard.vue";

const { award, members, step } = defineProps<{
  award: Award;
  members: Member[];
  step: AwardsStep;
}>();

const emit = defineEmits<{ (e: "reveal"): void }>();

const showResult = ref(step === AwardsStep.Completed);
const revealResult = () => {
  showResult.value = true;
  emit("reveal");
};

const nominationsWithScore = computed(() =>
  award.nominations
    .map((nomination) => ({
      ...nomination,
      score: Object.keys(nomination.ranking).reduce(
        (currentScore, rankingKey) =>
          currentScore + nomination.ranking[rankingKey],
        0,
      ),
    }))
    .sort((nomA, nomB) => nomA.score - nomB.score),
);

const maxScore = computed(() =>
  Math.min(...nominationsWithScore.value.map((nomination) => nomination.score)),
);
</script>
