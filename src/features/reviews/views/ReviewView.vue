<template>
  <div class="p-2">
    <add-review-prompt v-if="modalOpen" @close="closePrompt" />
    <page-header :has-back="true" back-route="ClubHome" page-name="Reviews">
      <div class="flex gap-2">
        <mdicon name="table" />
        <VToggle v-model="isGalleryView" />
        <mdicon name="image-multiple" />
      </div>
    </page-header>
    <loading-spinner v-if="loading" />
    <div v-else>
      <div
        class="flex justify-center items-center"
        :class="isGalleryView ? 'mb-4' : 'mb-0'"
      >
        <div class="relative">
          <mdicon
            name="magnify"
            class="absolute top-1/2 left-8 transform -translate-y-1/2 text-slate-200"
          />
          <input
            ref="searchInput"
            v-model="searchTerm"
            class="p-2 pl-12 text-base outline-none rounded-md border-2 text-white border-slate-600 focus:border-primary w-11/12 bg-background"
            placeholder="Search"
            @focusin="searchInputFocusIn"
            @focusout="searchInputFocusOut"
          />
          <div
            ref="searchInputSlash"
            class="border-2 rounded-md absolute top-1/2 right-8 px-2 py-1 transform -translate-y-1/2 border-slate-600"
          >
            <p name="slash" class="text-xs text-slate-200">/</p>
          </div>
        </div>
        <v-btn
          class="ml-2 h-11 w-11 whitespace-nowrap flex justify-center items-center"
          @click="openPrompt()"
        >
          <mdicon name="plus" />
        </v-btn>
      </div>
      <table-view
        v-if="!isGalleryView"
        :reviews="filteredReviews"
        :members="members ?? []"
        :open-prompt="openPrompt"
        :submit-score="submitScore"
      />
      <gallery-view
        v-else
        :reviews="filteredReviews"
        :members="members ?? []"
      />
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from "vue";

import { filterMovies } from "../../../common/searchMovies";
import GalleryView from "../components/GalleryView.vue";
import TableView from "../components/TableView.vue";

import VToggle from "@/common/components/VToggle.vue";
import { WorkType } from "@/common/types/generated/db";
import { DetailedWorkListItem } from "@/common/types/lists";
import { TMDBMovieData } from "@/common/types/movie";
import { Review } from "@/common/types/reviews";
import AddReviewPrompt from "@/features/reviews/components/AddReviewPrompt.vue";
import { useMembers } from "@/service/useClub";
import { useReviews, useSubmitScore } from "@/service/useReview";

const { clubId } = defineProps<{ clubId: string }>();

const isGalleryView = ref(false);

const { isLoading: loadingReviews, data: reviews } = useReviews(clubId);
const { isLoading: loadingMembers, data: members } = useMembers(clubId);

const loading = computed(() => loadingReviews.value || loadingMembers.value);

const modalOpen = ref(false);
const openPrompt = () => {
  modalOpen.value = true;
};
const closePrompt = () => {
  modalOpen.value = false;
};

const { mutate: submit } = useSubmitScore(clubId);

const submitScore = (movieId: number, score: number) => {
  if (!isNaN(score) && score >= 0 && score <= 10) {
    submit({ movieId, score });
  }
};

const reviewToDetailedWorkListItem = (
  review: Review
): DetailedWorkListItem<TMDBMovieData> => {
  return {
    id: review.movieId.toString(),
    externalId: review.movieId.toString(),
    title: review.movieTitle,
    imageUrl: review.posterUrl,
    type: WorkType.movie,
    createdDate: review.timeWatched["@ts"],
    externalData: review.movieData,
  };
};

const searchTerm = ref("");
const filteredReviews = computed<Review[]>(() => {
  return filterMovies(
    reviews.value?.map(reviewToDetailedWorkListItem) ?? [],
    searchTerm.value
  ).flatMap((movie) => {
    const review = reviews.value?.find(
      (review) => review.movieId.toString() === movie.id
    );
    return review ? [review] : [];
  });
});

const searchInput = ref<HTMLInputElement | null>(null);
const searchInputSlash = ref<HTMLParagraphElement | null>(null);

const onKeyPress = (e: KeyboardEvent) => {
  if (e.key == "/") {
    if (searchInput.value === document.activeElement) {
      return;
    }
    e.preventDefault();
    searchInput.value?.focus();
  }
};

onMounted(() => {
  window.addEventListener("keypress", onKeyPress);
});

onUnmounted(() => {
  window.removeEventListener("keypress", onKeyPress);
});

const searchInputFocusIn = () => {
  searchInputSlash.value?.setAttribute("hidden", "true");
};

const searchInputFocusOut = () => {
  searchInputSlash.value?.removeAttribute("hidden");
};
</script>
