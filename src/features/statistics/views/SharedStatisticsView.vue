<template>
  <div class="relative min-h-screen p-6 pb-24">
    <div class="mx-auto max-w-6xl space-y-6">
      <div class="text-center">
        <h1 class="text-3xl font-bold text-white">
          {{ club?.clubName ?? clubSlug }}
        </h1>
        <p class="mt-1 text-gray-400">Statistics</p>
      </div>

      <loading-spinner v-if="loading" />

      <EmptyState
        v-else-if="!hasReviews"
        title="No Statistics Yet"
        description="Statistics will appear once this club has reviewed some movies."
      />

      <div v-else>
        <div class="mb-4 flex items-center justify-center gap-2">
          <mdicon name="view-dashboard" />
          <VToggle v-model="showScoresView" />
          <mdicon name="table" />
        </div>

        <InsightsView
          v-if="!showScoresView"
          :movie-data="movieData"
          :members="members"
          :histogram-data="histogramData"
        />
        <ScoresView
          v-else
          :filtered-movie-data="filteredMovieData"
          :members="members"
          :search-term="searchTerm"
          :show-score-context="showScoreContext"
          :has-search-term="hasSearchTerm"
          @update:search-term="searchTerm = $event"
          @update:show-score-context="toggleScoreContext"
        />
      </div>
    </div>

    <SharedPageCtaBanner />
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useRoute } from "vue-router";

import InsightsView from "./InsightsView.vue";
import ScoresView from "./ScoresView.vue";
import { useStatisticsData } from "../composables/useStatisticsData";

import EmptyState from "@/common/components/EmptyState.vue";
import SharedPageCtaBanner from "@/common/components/SharedPageCtaBanner.vue";
import VToggle from "@/common/components/VToggle.vue";
import { useClub } from "@/service/useClub";

const route = useRoute();
const clubSlug = route.params.clubSlug as string;

const { data: club } = useClub(clubSlug);

const {
  loading,
  movieData,
  filteredMovieData,
  members,
  histogramData,
  searchTerm,
  showScoreContext,
  hasReviews,
  hasSearchTerm,
  toggleScoreContext,
} = useStatisticsData();

const showScoresView = ref(false);
</script>
