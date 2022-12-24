<template>
  <div class="p-1">
    <page-header 
      :has-back="true"
      back-route="ClubHome"
      page-name="Reviews"
    />
    <loading-spinner v-if="loading" />
    <div 
      v-else 
      class="md:px-6"
    >
      <input
        v-model="searchTerm"
        class="mb-4 p-2 text-base text-black outline-none rounded-md border-2 border-gray-300 focus:border-primary w-11/12 max-w-md"
        placeholder="Search"
      >
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRoute } from 'vue-router';
import ReviewCard from '@/features/reviews/components/ReviewCard.vue'
import LoadingSpinner from '@/common/components/LoadingSpinner.vue';
import { useDetailedReview } from '@/service/useReview';
import { useMembers } from '@/service/useClub';
import { filterReviews } from '../searchReviews';

const route = useRoute();

const { 
  data: reviews, 
  loading: loadingReviews 
} = useDetailedReview(route.params.clubId as string);

const {
  data: allMembers,
  loading: loadingMembers
} = useMembers(route.params.clubId as string);

const members = computed(() => allMembers.value.filter(member => !member.devAccount));

const loading = computed(() => loadingReviews.value || loadingMembers.value);

const searchTerm = ref<string>("");

const filteredReviews = computed(() => {
  return filterReviews(reviews.value, searchTerm.value);
});

</script>
