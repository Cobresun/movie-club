<template>
  <MoviePosterCard
    :movie-title="movieTitle"
    :movie-poster-url="moviePosterUrl"
    :highlighted="false"
  >
    <div class="grid grid-cols-2 gap-2">
      <div
        v-for="member in members"
        :key="member.name"
        class="flex items-center bg-lowBackground rounded-3xl"
      >
        <v-avatar :size="32" :name="member.name" :src="member.image" />
        <div v-if="review.scores[member.name]" class="flex-grow text-sm">
          {{ review.scores[member.name] }}
        </div>
        <div v-else-if="member.name === user?.name" class="flex-grow">
          <mdicon
            v-if="!inputIsOpen"
            name="plus"
            role="button"
            aria-label="Add score"
            class="cursor-pointer"
            @click="openScoreInput"
          />
          <input
            v-show="inputIsOpen"
            ref="scoreInputRef"
            v-model="scoreInputValue"
            aria-label="Score"
            class="bg-background rounded-xl outline-none border border-gray-300 focus:border-primary p-2 w-8 h-6 text-center text-sm"
            @keypress.enter="
              () => emit('submitScore', parseFloat(scoreInputValue))
            "
          />
        </div>
      </div>
    </div>
  </MoviePosterCard>
</template>

<script setup lang="ts">
import { nextTick, ref } from "vue";

import MoviePosterCard from "../../../common/components/MoviePosterCard.vue";

import { Member } from "@/common/types/club";
import { Review } from "@/common/types/reviews";
import { useUser } from "@/service/useUser";

const { review, members, movieTitle, moviePosterUrl } = defineProps<{
  review: Review;
  members: Member[];
  movieTitle: string;
  moviePosterUrl: string;
}>();

const emit = defineEmits<{ (e: "submitScore", score: number): void }>();

const { data: user } = useUser();

const scoreInputValue = ref("");
const scoreInputRef = ref<HTMLInputElement[]>([]);
const inputIsOpen = ref(false);

const openScoreInput = () => {
  inputIsOpen.value = true;
  nextTick(() => {
    scoreInputRef.value[0]?.focus();
  });
};
</script>
