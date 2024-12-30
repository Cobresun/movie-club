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
    <div v-if="showResult" class="grid grid-cols-auto">
      <MoviePosterCard
        v-for="nomination in nominationsWithScore"
        :key="nomination.movieId"
        :movie-title="nomination.movieTitle"
        :movie-poster-url="nomination.posterUrl"
        :highlighted="nomination.score === maxScore"
      >
        <div class="grid grid-cols-2 gap-2">
          <div
            v-for="member in members"
            :key="member.name"
            class="flex items-center rounded-3xl bg-lowBackground"
          >
            <v-avatar :size="32" :name="member.name" :src="member.image" />
            <div class="flex-grow text-sm">
              {{ nomination.ranking[member.name] }}
            </div>
          </div>
        </div>
      </MoviePosterCard>
    </div></transition-group
  >
</template>
<script setup lang="ts">
import { computed, ref } from "vue";

import { Award, AwardsStep } from "../../../../lib/types/awards";
import { Member } from "../../../../lib/types/club";

import MoviePosterCard from "@/common/components/MoviePosterCard.vue";

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
