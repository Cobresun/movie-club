<template>
  <div class="md:px-6">
    <input
      v-model="searchTerm"
      class="mb-4 p-2 text-base outline-none rounded-md border-2 text-white border-slate-600 focus:border-primary w-11/12 max-w-md bg-background"
      placeholder="Search"
    />
    <transition-group
      tag="div"
      leave-active-class="absolute hidden"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
      class="grid grid-cols-auto justify-items-center"
    >
      <ReviewCard
        v-for="review in filteredReviews"
        :key="review.movieId"
        class="transition-all ease duration-500"
        :review="review"
        :members="members"
        :movie-title="review.movieData.title"
        :movie-poster-url="review.movieData.poster_url"
      />
    </transition-group>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";

import { filterReviews } from "../searchReviews";

import { DetailedReviewResponse, Member } from "@/common/types/models";
import ReviewCard from "@/features/reviews/components/ReviewCard.vue";

const { reviews, members: allMembers } = defineProps<{
  reviews: DetailedReviewResponse[];
  members: Member[];
}>();

const members = computed(() =>
  allMembers.filter((member) => !member.devAccount)
);

const searchTerm = ref<string>("");

const filteredReviews = computed(() => {
  return filterReviews(reviews ?? [], searchTerm.value);
});
</script>
