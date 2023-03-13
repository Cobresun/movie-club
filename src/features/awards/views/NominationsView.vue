<template>
  <h2 class="text-2xl font-bold m-4">Nominations</h2>
  <div v-for="award in userOnlyAwards" :key="award.title">
    <h3 class="text-xl font-bold text-left mb-2">{{ award.title }}</h3>
    <div class="grid grid-cols-auto">
      <MoviePosterCard
        v-for="nomination in award.nominations"
        :key="nomination.movieId"
        :movie-title="nomination.movieTitle"
        :movie-poster-url="nomination.movieData.poster_url"
      ></MoviePosterCard>
      <AddMovieButton />
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed } from "vue";

import AddMovieButton from "../components/AddMovieButton.vue";

import MoviePosterCard from "@/common/components/MoviePosterCard.vue";
import { ClubAwards } from "@/common/types/models";
import { useUser } from "@/service/useUser";

const { clubAward, clubId, year } = defineProps<{
  clubAward: ClubAwards;
  clubId: string;
  year: string;
}>();

const { data: user } = useUser();

const userOnlyAwards = computed(() => {
  if (!user.value || !user.value.name) return [];
  return clubAward.awards.map((award) => ({
    ...award,
    nominations: award.nominations.filter((nomination) =>
      nomination.nominatedBy.includes(user.value?.name ?? "")
    ),
  }));
});
</script>
