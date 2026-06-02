<template>
  <div class="text-center">
    <page-header
      :has-back="true"
      back-route="ClubHome"
      page-name="Statistics"
    />
    <loading-spinner v-if="loading" />

    <div v-if="!loading && !hasReviews">
      <EmptyState
        title="No Statistics Yet"
        description="Statistics will appear once your club has reviewed some movies. Get started by adding your first review!"
        action-label="Go to Reviews"
        action-icon="arrow-right"
        @action="navigateToReviews"
      />
    </div>

    <div v-else-if="!loading && hasReviews">
      <InsightsView
        :movie-data="movieData"
        :members="members"
        :histogram-data="histogramData"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from "vue-router";

import InsightsView from "./InsightsView.vue";
import { useStatisticsData } from "../composables/useStatisticsData";

import EmptyState from "@/common/components/EmptyState.vue";

const { loading, movieData, members, histogramData, hasReviews } =
  useStatisticsData();

const router = useRouter();

const navigateToReviews = () => {
  router.push({ name: "Reviews" }).catch(console.error);
};
</script>
