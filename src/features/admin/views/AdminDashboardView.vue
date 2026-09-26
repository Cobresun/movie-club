<template>
  <div class="pb-16">
    <!-- hide-club is required here: PageHeader otherwise resolves a club from the
         route, and this route has no clubSlug to resolve. -->
    <page-header :has-back="false" page-name="Site metrics" hide-club />

    <div v-if="isUnauthorized" class="mx-auto w-11/12 max-w-lg py-16 text-center">
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

    <template v-else>
      <!-- The range drives every section below, so it stays in reach while
           scrolling rather than living at the top of one card. -->
      <div class="sticky top-0 z-10 bg-background/90 py-2 backdrop-blur">
        <div class="mx-auto flex w-11/12 max-w-6xl items-center justify-between gap-3">
          <SegmentedToggle v-model="range" :options="RANGE_OPTIONS" />
          <div class="flex shrink-0 items-center gap-2">
            <p v-if="dashboard" class="hidden text-xs text-slate-500 sm:block">
              Updated {{ formatRelativeTime(dashboard.generatedAt) }}
            </p>
            <v-btn
              :disabled="isFetching"
              :aria-label="isFetching ? 'Refreshing metrics' : 'Refresh metrics'"
              @click="refresh"
            >
              <mdicon name="refresh" size="20" :class="{ 'animate-spin': isFetching }" />
            </v-btn>
          </div>
        </div>
      </div>

      <AdminDashboardSkeleton v-if="isLoading" />

      <div
        v-else-if="dashboard"
        class="mx-auto mt-4 w-11/12 max-w-6xl space-y-4 transition-opacity"
        :class="{ 'opacity-60': isPreviousData }"
        :aria-busy="isPreviousData"
      >
        <section aria-label="Pulse" class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <PulseTile
            v-for="tile in pulseTiles"
            :key="tile.label"
            :label="tile.label"
            :count="tile.count"
            :comparison="rangePrevious(range)"
          />
        </section>

        <TrendsWidget
          :range="dashboard.range"
          :unit="dashboard.activity.unit"
          :buckets="dashboard.activity.buckets"
          :snapshots="history ?? []"
        />

        <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <WorksWidget :works="dashboard.works" :range="dashboard.range" />
          <FeedWidget :events="dashboard.feed" />
          <ClubsWidget
            :busiest="dashboard.clubs.busiest"
            :newest="dashboard.clubs.newest"
            :range="dashboard.range"
          />
          <PeopleWidget
            :most-active="dashboard.people.mostActive"
            :newest="dashboard.people.newest"
            :range="dashboard.range"
          />
        </div>

        <section aria-labelledby="health-heading" class="space-y-3 pt-4">
          <h2 id="health-heading" class="text-sm font-bold uppercase tracking-wide text-slate-400">
            Health
          </h2>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <RateTile
              label="Contribution"
              :percent="ratePercent(dashboard.health.contribution)"
              :detail="`${rateFraction(dashboard.health.contribution)} people who signed in`"
              hint="Wrote something, last 30 days"
              :good-at-or-above="40"
              :bad-below="15"
            />
            <RateTile
              label="New-user activation"
              :percent="ratePercent(dashboard.health.newUserActivation)"
              :detail="`${rateFraction(dashboard.health.newUserActivation)} who signed up`"
              :hint="`Did anything at all, joined ${rangeWithin(dashboard.range)}`"
              :good-at-or-above="50"
              :bad-below="20"
            />
            <RateTile
              label="Discussion"
              :percent="ratePercent(dashboard.health.discussion)"
              :detail="`${rateFraction(dashboard.health.discussion)} reviewed titles`"
              hint="Drew at least one comment"
              :good-at-or-above="30"
            />
          </div>
          <ClubStatusWidget :status="dashboard.health.clubStatus" />
        </section>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import axios from "axios";
import { computed, ref } from "vue";

import { DEFAULT_METRICS_RANGE, MetricsRange } from "../../../../lib/types/metrics";
import AdminDashboardSkeleton from "../components/AdminDashboardSkeleton.vue";
import ClubStatusWidget from "../components/ClubStatusWidget.vue";
import ClubsWidget from "../components/ClubsWidget.vue";
import FeedWidget from "../components/FeedWidget.vue";
import PeopleWidget from "../components/PeopleWidget.vue";
import PulseTile from "../components/PulseTile.vue";
import RateTile from "../components/RateTile.vue";
import TrendsWidget from "../components/TrendsWidget.vue";
import WorksWidget from "../components/WorksWidget.vue";
import { formatRelativeTime, rateFraction, ratePercent } from "../formatMetrics";
import { RANGE_OPTIONS, rangePrevious, rangeWithin } from "../ranges";
import SegmentedToggle from "@/features/statistics/components/SegmentedToggle.vue";
import { useAdminMetrics, useAdminMetricsHistory } from "@/service/useAdminMetrics";

const range = ref<MetricsRange>(DEFAULT_METRICS_RANGE);

const {
  data: dashboard,
  isLoading,
  isError,
  isFetching,
  isPreviousData,
  error,
  refetch,
} = useAdminMetrics(range);
const { data: history, refetch: refetchHistory } = useAdminMetricsHistory(range);

const refresh = () => Promise.all([refetch(), refetchHistory()]);

/**
 * A 401 is the expected answer for everyone who isn't on the allowlist, so it
 * gets a plain explanation rather than the generic failure state. Authorization
 * lives entirely on the API — the route itself is not access-controlled, so this
 * is where a non-admin finds out.
 */
const isUnauthorized = computed(
  () => axios.isAxiosError(error.value) && error.value.response?.status === 401,
);

const pulseTiles = computed(() => {
  const pulse = dashboard.value?.pulse;
  if (pulse === undefined) return [];
  return [
    { label: "Active clubs", count: pulse.activeClubs },
    { label: "Active people", count: pulse.activeUsers },
    { label: "Reviews", count: pulse.reviews },
    { label: "Comments", count: pulse.comments },
    { label: "New people", count: pulse.newUsers },
    { label: "New clubs", count: pulse.newClubs },
  ];
});
</script>
