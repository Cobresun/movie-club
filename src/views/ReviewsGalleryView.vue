<template>
  <div class="m-1">
    <div class="grid items-center grid-cols-centerHeader gap-x-8">
      <router-link
        class="flex justify-end"
        to="/club-home"
      >
        <mdicon
          class="cursor-pointer"
          name="arrow-left"
          size="40"
        />
      </router-link>
      <h1 class="text-3xl font-bold m-4">
        Cobresun Reviews
      </h1>
      <div class="min-w-[40px]" />
    </div>
    <loading-spinner v-if="loading" />
    <div 
      v-else 
      class="md:px-6"
    >
      <input
        v-model="search"
        class="mb-4 p-2 text-base text-black outline-none rounded-md border-2 border-gray-300 focus:border-primary w-11/12 max-w-md"
        placeholder="Search"
      >
      <div class="grid grid-cols-auto justify-items-center">
        <ReviewCard
          v-for="review in filteredReviews"
          :key="review.movieId"
          :review="review"
          :members="members"
          :movie-title="review.movieData.title"
          :movie-poster-url="review.movieData.poster_url"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import axios from 'axios'
import ReviewCard from '@/components/ReviewCard.vue'
import { DetailedReviewResponse, Member } from '@/models';
import LoadingSpinner from '@/components/LoadingSpinner.vue';

const reviews = ref<DetailedReviewResponse[]>([]);
const loadingReviews = ref(true);
axios
  .get<DetailedReviewResponse[]>('/api/reviews', { params: { detailed: true } })
  .then((response) => {
    reviews.value = response.data;
    loadingReviews.value = false;
  });

const members = ref<Member[]>([]);
const loadingMembers = ref(true);
axios
  .get<Member[]>('/api/club/8/members')
  .then((response) => {
    members.value = response.data.filter(member => !member.devAccount);
    loadingMembers.value = false;
  });

const loading = computed(() => loadingReviews.value || loadingMembers.value);

const search = ref<string>("");

const filteredReviews = computed(() => {
  return reviews.value.filter(review =>
    review.movieTitle.toLowerCase().includes(search.value.toLowerCase()) ||
    review.movieData.production_companies
      .some(company => company.name.toLocaleLowerCase().includes(search.value))
    )
})
</script>
