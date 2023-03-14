<template>
  <v-modal v-if="currentAward" @close="closePrompt">
    <div class="flex flex-col h-full">
      <h3 class="text-xl font-bold text-left mb-2">{{ currentAward.title }}</h3>
      <div class="flex-grow overflow-auto">
        <MovieSearchPrompt
          :default-list="reviewsForYear"
          :default-list-title="`${year} Reviews`"
          :include-search="false"
          @select-from-default="addNomination"
          @close="closePrompt"
        />
      </div>
    </div>
  </v-modal>
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
      <AddMovieButton
        v-for="index in getAddButtonNumber(award)"
        :key="index"
        @click="openPrompt(award)"
      />
    </div>
  </div>
</template>
<script setup lang="ts">
import { DateTime } from "luxon";
import { computed, ref } from "vue";

import AddMovieButton from "../components/AddMovieButton.vue";
import { NOMINATIONS_PER_AWARD } from "../constants";

import MoviePosterCard from "@/common/components/MoviePosterCard.vue";
import MovieSearchPrompt from "@/common/components/MovieSearchPrompt.vue";
import { ClubAwards, Award, MovieSearchIndex } from "@/common/types/models";
import { useAddNomination } from "@/service/useAwards";
import { useDetailedReview } from "@/service/useReview";
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

const getAddButtonNumber = (award: Award) =>
  NOMINATIONS_PER_AWARD - award.nominations.length;

const currentAward = ref<Award | undefined>();
const openPrompt = (award: Award) => {
  currentAward.value = award;
};
const closePrompt = () => {
  currentAward.value = undefined;
};

const { data: reviews } = useDetailedReview(clubId);
const reviewsForYear = computed(() => {
  if (!reviews.value) return [];
  return reviews.value
    .filter(
      (review) =>
        DateTime.fromISO(review.timeWatched["@ts"]).year === parseInt(year)
    )
    .map((review) => ({ ...review.movieData }));
});

const { mutate } = useAddNomination(clubId, year);

const addNomination = (movie: MovieSearchIndex) => {
  const review = reviews.value?.find((review) => review.movieId === movie.id);
  if (!currentAward.value || !review) return;
  mutate({ awardTitle: currentAward.value.title, review });
  closePrompt();
};
</script>
