<template>
  <div class="md:px-6">
    <transition-group
      tag="div"
      leave-active-class="absolute hidden"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
      class="grid grid-cols-auto justify-items-center"
    >
      <ReviewCard
        v-for="review in reviews"
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
import { computed } from "vue";

import { DetailedReviewResponse, Member } from "@/common/types/models";
import ReviewCard from "@/features/reviews/components/ReviewCard.vue";

const { reviews, members: allMembers } = defineProps<{
  reviews: DetailedReviewResponse[];
  members: Member[];
}>();

const members = computed(() =>
  allMembers.filter((member) => !member.devAccount)
);
</script>
