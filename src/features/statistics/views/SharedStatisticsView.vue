<template>
  <div class="relative min-h-screen pb-24">
    <SharedPageHeader
      :club-name="club?.clubName ?? clubSlug"
      :members="members"
      eyebrow="Statistics"
    />

    <div class="mx-auto max-w-6xl space-y-6 px-6 pt-6">
      <loading-spinner v-if="loading" />

      <EmptyState
        v-else-if="!hasReviews"
        title="No Statistics Yet"
        description="Statistics will appear once this club has reviewed some movies."
      />

      <InsightsView
        v-else
        :movie-data="movieData"
        :members="members"
        :histogram-data="histogramData"
      />
    </div>

    <SharedPageCtaBanner />
  </div>
</template>

<script setup lang="ts">
import { useRoute } from "vue-router";

import InsightsView from "./InsightsView.vue";
import { useStatisticsData } from "../composables/useStatisticsData";

import EmptyState from "@/common/components/EmptyState.vue";
import SharedPageCtaBanner from "@/common/components/SharedPageCtaBanner.vue";
import SharedPageHeader from "@/common/components/SharedPageHeader.vue";
import { useClub } from "@/service/useClub";

const route = useRoute();
const clubSlug = route.params.clubSlug as string;

const { data: club } = useClub(clubSlug);

const { loading, movieData, members, histogramData, hasReviews } =
  useStatisticsData();
</script>
