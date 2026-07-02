<template>
  <div class="text-center">
    <page-header :has-back="true" back-route="ClubHome" page-name="Statistics">
      <button
        v-if="!isLoading && hasReviews"
        class="text-white transition hover:text-primary"
        title="Share statistics"
        @click="shareStats"
      >
        <mdicon name="share-variant" />
      </button>
    </page-header>
    <loading-spinner v-if="isLoading" />

    <div v-else-if="!hasReviews">
      <EmptyState
        title="No Statistics Yet"
        :description="`Statistics will appear once your club has reviewed some ${workNoun}s. Get started by adding your first review!`"
        action-label="Go to Reviews"
        action-icon="arrow-right"
        @action="navigateToReviews"
      />
    </div>

    <div v-else-if="clubType !== undefined">
      <InsightsView
        :work-data="workData"
        :members="members"
        :histogram-data="histogramData"
        :club-type="clubType"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";

import InsightsView from "./InsightsView.vue";
import { isDefined } from "../../../../lib/checks/checks.js";
import { ClubType } from "../../../../lib/types/generated/db";
import { useStatisticsData } from "../composables/useStatisticsData";

import { clubTypeConfig } from "@/common/clubType";
import EmptyState from "@/common/components/EmptyState.vue";
import { useShare } from "@/common/composables/useShare";
import { useClub, useClubSlug } from "@/service/useClub";

const { loading, workData, members, histogramData, hasReviews } =
  useStatisticsData();

const clubSlug = useClubSlug();
const { data: club } = useClub(clubSlug);
const clubType = computed(() => club.value?.type);

// Wait for the club query too: the widget set and copy depend on club type.
const isLoading = computed(() => loading.value || !isDefined(club.value));

const workNoun = computed(() =>
  isDefined(clubType.value) ? clubTypeConfig(clubType.value).noun : "movie",
);

const router = useRouter();

const navigateToReviews = () => {
  router.push({ name: "Reviews" }).catch(console.error);
};

const { share } = useShare();

const shareStats = () => {
  share({
    url: `${window.location.origin}/share/club/${clubSlug}/statistics`,
    title:
      clubType.value === ClubType.book
        ? "Book Club Statistics"
        : "Movie Club Statistics",
  }).catch(console.error);
};
</script>
