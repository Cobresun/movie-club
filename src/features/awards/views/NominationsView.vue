<template>
  <v-modal v-if="currentAward" @close="closePrompt">
    <div class="flex h-full flex-col">
      <h3 class="mb-2 text-left text-xl font-bold">{{ currentAward.title }}</h3>
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
  <div class="relative">
    <h2 class="m-4 text-2xl font-bold">Nominations</h2>
    <div v-for="award in userOnlyAwards" :key="award.title">
      <h3 class="mb-2 text-left text-xl font-bold">{{ award.title }}</h3>
      <div class="grid grid-cols-auto">
        <MoviePosterCard
          v-for="nomination in award.nominations"
          :key="nomination.movieId"
          :movie-title="nomination.movieTitle"
          :movie-poster-url="nomination.posterUrl"
          show-delete
          @delete="
            deleteNomination({
              awardTitle: award.title,
              movieId: nomination.movieId,
            })
          "
        ></MoviePosterCard>
        <AddMovieButton
          v-for="index in getAddButtonNumber(award)"
          :key="index"
          @click="openPrompt(award)"
        />
      </div>
    </div>

    <!-- Floating Progress Indicator -->
    <div
      class="fixed bottom-6 right-6 z-10 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-3 shadow-lg transition-all hover:shadow-xl"
    >
      <div class="flex items-center gap-3">
        <div class="text-white">
          <div class="text-sm font-medium opacity-90">Nomination Progress</div>
          <div class="text-lg font-bold">
            {{ completedCategoriesCount }} / {{ totalCategories }} categories
          </div>
        </div>
        <div class="flex h-12 w-12 items-center justify-center">
          <svg
            class="h-12 w-12 -rotate-90 transform"
            viewBox="0 0 36 36"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle
              cx="18"
              cy="18"
              r="16"
              fill="none"
              stroke="rgba(255, 255, 255, 0.3)"
              stroke-width="3"
            />
            <circle
              cx="18"
              cy="18"
              r="16"
              fill="none"
              stroke="white"
              stroke-width="3"
              :stroke-dasharray="`${progressPercentage}, 100`"
              stroke-linecap="round"
            />
          </svg>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { DateTime } from "luxon";
import { computed, ref } from "vue";

import { Award, ClubAwards } from "../../../../lib/types/awards";
import { WorkListType } from "../../../../lib/types/generated/db";
import { MovieSearchIndex } from "../../../../lib/types/movie";
import AddMovieButton from "../components/AddMovieButton.vue";
import { NOMINATIONS_PER_AWARD } from "../constants";

import MoviePosterCard from "@/common/components/MoviePosterCard.vue";
import MovieSearchPrompt from "@/common/components/MovieSearchPrompt.vue";
import { useAddNomination, useDeleteNomination } from "@/service/useAwards";
import { useList } from "@/service/useList";
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
      nomination.nominatedBy.includes(user.value?.name ?? ""),
    ),
  }));
});

const totalCategories = computed(() => clubAward.awards.length);

const completedCategoriesCount = computed(() => {
  return userOnlyAwards.value.filter((award) => award.nominations.length > 0)
    .length;
});

const progressPercentage = computed(() => {
  if (totalCategories.value === 0) return 0;
  return (completedCategoriesCount.value / totalCategories.value) * 100;
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

const { data: reviews } = useList(clubId, WorkListType.reviews);
const reviewsForYear = computed(() => {
  if (!reviews.value) return [];
  return reviews.value
    .filter(
      (review) => DateTime.fromISO(review.createdDate).year === parseInt(year),
    )
    .map((review) => ({
      title: review.title,
      release_date: review.externalData?.release_date ?? "",
      id: parseInt(review.externalId ?? "0"),
      poster_path: review.externalData?.poster_path ?? "",
    }));
});

const { mutate } = useAddNomination(clubId, year);

const addNomination = (movie: MovieSearchIndex) => {
  const review = reviews.value?.find(
    (review) => parseInt(review.externalId ?? "0") === movie.id,
  );
  if (!currentAward.value || !review) return;
  mutate({ awardTitle: currentAward.value.title, review });
  closePrompt();
};

const { mutate: deleteNomination } = useDeleteNomination(clubId, year);
</script>
