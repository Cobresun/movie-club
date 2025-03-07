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
