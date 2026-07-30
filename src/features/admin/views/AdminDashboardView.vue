<template>
  <div class="pb-12">
    <!-- hide-club is required here: PageHeader otherwise resolves a club from the
         route, and this route has no clubSlug to resolve. -->
    <page-header :has-back="false" page-name="Site metrics" hide-club />

    <loading-spinner v-if="isLoading" />

    <div v-else-if="isUnauthorized" class="mx-auto w-11/12 max-w-lg py-16 text-center">
      <h2 class="text-xl font-bold text-white">Not available</h2>
      <p class="mt-2 text-sm text-slate-400">
        This page is limited to site administrators. If that should include you, ask for your email
        to be added to the admin allowlist.
      </p>
    </div>

    <div v-else-if="isError" class="mx-auto w-11/12 max-w-lg py-16 text-center">
      <h2 class="text-xl font-bold text-white">Couldn't load metrics</h2>
      <p class="mt-2 text-sm text-slate-400">Something went wrong fetching the numbers.</p>
      <v-btn class="mt-4" @click="refetch()">Try again</v-btn>
    </div>

    <div v-else-if="metrics" class="space-y-6">
      <div class="mx-auto grid w-11/12 grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <KpiTile
          label="Users"
          :value="metrics.totals.users"
          :caption="`${percentOf(metrics.totals.verifiedUsers, metrics.totals.users)}% verified`"
        />
        <KpiTile
          label="Clubs"
          :value="metrics.totals.clubs"
          :caption="`${metrics.totals.movieClubs} movie · ${metrics.totals.bookClubs} book`"
        />
        <KpiTile
          label="Memberships"
          :value="metrics.totals.memberships"
          :caption="`across ${metrics.totals.lists} lists`"
        />
        <KpiTile
          label="Reviews"
          :value="metrics.totals.reviews"
          :caption="`${metrics.totals.comments} comments`"
        />
        <KpiTile label="Works" :value="metrics.totals.works" caption="movies and books tracked" />
      </div>

      <div class="mx-auto grid w-11/12 grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiTile label="New users (7d)" :value="metrics.newUsers.last7Days" />
        <KpiTile label="New users (30d)" :value="metrics.newUsers.last30Days" />
        <KpiTile label="New clubs (7d)" :value="metrics.newClubs.last7Days" />
        <KpiTile label="New clubs (30d)" :value="metrics.newClubs.last30Days" />
      </div>

      <EngagementWidget
        :engaged-users="metrics.engagedUsers"
        :logged-in-users="metrics.loggedInUsers"
        :active-clubs="metrics.activeClubs"
      />

      <GrowthWidget :users="metrics.weekly.users" :clubs="metrics.weekly.clubs" />

      <ReviewVolumeWidget :reviews="metrics.weekly.reviews" />

      <SnapshotHistoryWidget :history="history ?? []" />

      <TopClubsWidget :clubs="metrics.topClubs" />

      <p class="mx-auto w-11/12 text-center text-xs text-slate-600">
        Generated {{ metrics.generatedAt }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import axios from "axios";
import { computed } from "vue";

import EngagementWidget from "../components/EngagementWidget.vue";
import GrowthWidget from "../components/GrowthWidget.vue";
import KpiTile from "../components/KpiTile.vue";
import ReviewVolumeWidget from "../components/ReviewVolumeWidget.vue";
import SnapshotHistoryWidget from "../components/SnapshotHistoryWidget.vue";
import TopClubsWidget from "../components/TopClubsWidget.vue";
import { percentOf } from "../formatMetrics";
import { useAdminMetrics, useAdminMetricsHistory } from "@/service/useAdminMetrics";

const { data: metrics, isLoading, isError, error, refetch } = useAdminMetrics();
const { data: history } = useAdminMetricsHistory();

/**
 * A 401 is the expected answer for everyone who isn't on the allowlist, so it
 * gets a plain explanation rather than the generic failure state. Authorization
 * lives entirely on the API — the route itself is not access-controlled, so this
 * is where a non-admin finds out.
 */
const isUnauthorized = computed(
  () => axios.isAxiosError(error.value) && error.value.response?.status === 401,
);
</script>
