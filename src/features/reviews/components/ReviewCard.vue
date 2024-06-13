<template>
  <MoviePosterCard
    :movie-title="movieTitle"
    :movie-poster-url="moviePosterUrl"
    :highlighted="false"
  >
    <div class="grid grid-cols-2 gap-2">
      <div
        v-for="member in members"
        :key="member.id"
        class="flex items-center bg-lowBackground rounded-3xl"
      >
        <v-avatar :size="32" :name="member.name" :src="member.image" />
        <div class="flex-grow text-sm">
          {{ review.scores[member.id] }}
        </div>
      </div>
    </div>
  </MoviePosterCard>
</template>

<script setup lang="ts">
import MoviePosterCard from "../../../common/components/MoviePosterCard.vue";

import { Member } from "@/common/types/club";
import { DetailedReviewListItem } from "@/common/types/lists";

const { review, members, movieTitle, moviePosterUrl } = defineProps<{
  review: DetailedReviewListItem;
  members: Member[];
  movieTitle: string;
  moviePosterUrl: string;
}>();
</script>
