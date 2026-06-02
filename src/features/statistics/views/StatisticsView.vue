<template>
  <div class="text-center">
    <page-header :has-back="true" back-route="ClubHome" page-name="Statistics">
      <div v-if="!loading && hasReviews" class="flex items-center gap-2">
        <mdicon name="view-dashboard" />
        <VToggle v-model="showScoresView" />
        <mdicon name="table" />
        <button
          class="ml-2 text-white transition hover:text-primary"
          title="Share statistics"
          @click="shareStats"
        >
          <mdicon name="share-variant" />
        </button>
      </div>
    </page-header>
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
        v-if="!showScoresView"
        :movie-data="movieData"
        :members="members"
        :histogram-data="histogramData"
      />
      <ScoresView
        v-else
        :movie-data="movieData"
        :members="members"
        :show-score-context="showScoreContext"
        @update:show-score-context="toggleScoreContext"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";

import InsightsView from "./InsightsView.vue";
import ScoresView from "./ScoresView.vue";
import { useStatisticsData } from "../composables/useStatisticsData";

import EmptyState from "@/common/components/EmptyState.vue";
import VToggle from "@/common/components/VToggle.vue";
import { useShare } from "@/common/composables/useShare";
import { useClubSlug } from "@/service/useClub";

const {
  loading,
  movieData,
  members,
  histogramData,
  showScoreContext,
  hasReviews,
  toggleScoreContext,
} = useStatisticsData();

const showScoresView = ref(false);

const router = useRouter();

const navigateToReviews = () => {
  router.push({ name: "Reviews" }).catch(console.error);
};

const { share } = useShare();
const clubSlug = useClubSlug();

const shareStats = () => {
  share({
    url: `${window.location.origin}/share/club/${clubSlug}/statistics`,
    title: "Movie Club Statistics",
  }).catch(console.error);
};
</script>
