<template>
  <div class="flex justify-between mb-2">
    <h3 class="text-xl font-bold text-left">{{ award.title }}</h3>
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
        :movie-poster-url="nomination.movieData.poster_url"
        :highlighted="nomination.score === maxScore"
      >
        <div class="grid grid-cols-2 gap-2">
          <div
            v-for="member in members"
            :key="member.name"
            class="flex items-center bg-lowBackground rounded-3xl"
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

import MoviePosterCard from "@/common/components/MoviePosterCard.vue";
import { Award, AwardsStep, Member } from "@/common/types/models";

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
          currentScore +
          (award.nominations.length - nomination.ranking[rankingKey]),
        0
      ),
    }))
    .sort((nomA, nomB) => nomB.score - nomA.score)
);

const maxScore = computed(() =>
  Math.max(...nominationsWithScore.value.map((nomination) => nomination.score))
);
</script>