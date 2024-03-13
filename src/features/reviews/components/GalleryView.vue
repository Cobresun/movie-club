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
        :movie-poster-url="review.posterUrl"
      />
    </transition-group>
  </div>
</template>

<script setup lang="ts">
import { Member } from "@/common/types/club";
import { Review } from "@/common/types/reviews";
import ReviewCard from "@/features/reviews/components/ReviewCard.vue";

const { reviews, members: members } = defineProps<{
  reviews: Review[];
  members: Member[];
}>();
</script>
