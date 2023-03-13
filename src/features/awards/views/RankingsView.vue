<template>
  <h2 class="text-2xl font-bold m-4">Rankings</h2>
  <div v-for="award in clubAward.awards" :key="award.title">
    <h3 class="text-xl font-bold text-left mb-2">{{ award.title }}</h3>
    <div class="grid grid-cols-auto">
      <MoviePosterCard
        v-for="nomination in award.nominations"
        :key="nomination.movieId"
        :movie-title="nomination.movieTitle"
        :movie-poster-url="nomination.movieData.poster_url"
        ><div class="flex gap-2">
          <v-avatar
            v-for="voter in nomination.nominatedBy"
            :key="voter"
            :size="32"
            :name="voter"
            :src="getMemberImage(voter)"
          /></div
      ></MoviePosterCard>
    </div>
  </div>
</template>
<script setup lang="ts">
import MoviePosterCard from "@/common/components/MoviePosterCard.vue";
import { ClubAwards } from "@/common/types/models";
import { useMembers } from "@/service/useClub";

const { clubAward, clubId, year } = defineProps<{
  clubAward: ClubAwards;
  clubId: string;
  year: string;
}>();

const { data: members } = useMembers(clubId);

const getMemberImage = (name: string) => {
  const member = members.value?.find((member) => member.name === name);
  if (member && member.image) return member.image;
  return undefined;
};
</script>
