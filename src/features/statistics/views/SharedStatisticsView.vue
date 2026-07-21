<template>
  <div class="relative min-h-screen pb-24">
    <SharedPageHeader
      :club-name="club?.clubName ?? clubSlug"
      :members="members"
      eyebrow="Statistics"
    />

    <div class="mx-auto max-w-6xl space-y-6 px-6 pt-6">
      <loading-spinner v-if="isLoading" />

      <EmptyState
        v-else-if="!hasReviews"
        title="No Statistics Yet"
        :description="`Statistics will appear once this club has reviewed some ${workNoun}s.`"
      />

      <InsightsView
        v-else-if="clubType !== undefined"
        :work-data="workData"
        :members="members"
        :histogram-data="histogramData"
        :club-type="clubType"
      />
    </div>

    <SharedPageCtaBanner />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";

import { isDefined } from "../../../../lib/checks/checks.js";
import { useStatisticsData } from "../composables/useStatisticsData";
import InsightsView from "./InsightsView.vue";
import { clubTypeConfig } from "@/common/clubType";
import EmptyState from "@/common/components/EmptyState.vue";
import SharedPageCtaBanner from "@/common/components/SharedPageCtaBanner.vue";
import SharedPageHeader from "@/common/components/SharedPageHeader.vue";
import { useClub } from "@/service/useClub";

const route = useRoute();
const clubSlug = route.params.clubSlug as string;

const { data: club } = useClub(clubSlug);
const clubType = computed(() => club.value?.type);

const { loading, workData, members, histogramData, hasReviews } = useStatisticsData();

// Wait for the club query too: the widget set and copy depend on club type.
const isLoading = computed(() => loading.value || !isDefined(club.value));

const workNoun = computed(() =>
  isDefined(clubType.value) ? clubTypeConfig(clubType.value).noun : "movie",
);
</script>
