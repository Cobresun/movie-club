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

    <div v-else-if="metrics" class="space-y-8">
      <!-- Freshness belongs where it's read, not in a footnote: the only
           question anyone asks of the capture time is whether the numbers are
           stale, and a relative phrasing answers it without arithmetic. -->
      <div class="mx-auto flex w-11/12 items-center justify-between gap-3">
        <p class="text-sm text-slate-500">Updated {{ generatedLabel }}</p>
        <v-btn :disabled="isFetching" @click="refetch()">
          {{ isFetching ? "Refreshing…" : "Refresh" }}
        </v-btn>
      </div>

      <section class="space-y-4">
        <h2 class="mx-auto w-11/12 text-sm font-bold uppercase tracking-wide text-slate-400">
          Scale
        </h2>
        <div class="mx-auto grid w-11/12 grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <KpiTile
            label="Users"
            :value="metrics.totals.users"
            :delta="deltas.users"
            :caption="`${percentOf(metrics.totals.verifiedUsers, metrics.totals.users)}% verified`"
          />
          <KpiTile
            label="Clubs"
            :value="metrics.totals.clubs"
            :delta="deltas.clubs"
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
            :delta="deltas.reviews"
            :caption="`${metrics.totals.comments} comments`"
          />
          <KpiTile label="Works" :value="metrics.totals.works" caption="movies and books tracked" />
        </div>
      </section>

      <section class="space-y-4">
        <h2 class="mx-auto w-11/12 text-sm font-bold uppercase tracking-wide text-slate-400">
          Momentum
        </h2>

        <EngagementWidget
          :engaged-users="metrics.engagedUsers"
          :logged-in-users="metrics.loggedInUsers"
          :active-clubs="metrics.activeClubs"
          :new-users="metrics.newUsers"
          :new-clubs="metrics.newClubs"
        />

        <GrowthWidget
          :users="metrics.weekly.users"
          :clubs="metrics.weekly.clubs"
          :reviews="metrics.weekly.reviews"
        />

        <SnapshotHistoryWidget v-model:days="historyWindow" :history="history ?? []" />
      </section>

      <section class="space-y-4">
        <h2 class="mx-auto w-11/12 text-sm font-bold uppercase tracking-wide text-slate-400">
          Health
        </h2>

        <div class="mx-auto grid w-11/12 grid-cols-2 gap-3 lg:grid-cols-4">
          <RateTile
            label="Stickiness"
            :percent="stickinessPercent"
            :detail="`${formatCount(metrics.engagedUsers.last7Days)} of ${formatCount(metrics.engagedUsers.last30Days)} monthly actives`"
            hint="Came back within the week"
            :good-at-or-above="40"
            :bad-below="15"
          />
          <RateTile
            label="New-user activation"
            :percent="ratePercent(metrics.health.newUserActivation)"
            :detail="rateFraction(metrics.health.newUserActivation)"
            hint="Signed up in 30d and did something"
            :good-at-or-above="50"
            :bad-below="20"
          />
          <RateTile
            label="Works discussed"
            :percent="ratePercent(metrics.health.commentedWorks)"
            :detail="rateFraction(metrics.health.commentedWorks)"
            hint="Reviewed works that drew a comment"
            :good-at-or-above="40"
          />
          <RateTile
            label="Custom lists"
            :percent="ratePercent(metrics.health.customListAdoption)"
            :detail="rateFraction(metrics.health.customListAdoption)"
            hint="Clubs using a list beyond reviews"
            :good-at-or-above="50"
          />
        </div>

        <ClubHealthWidget
          :club-sizes="metrics.health.clubSizes"
          :dormant-clubs="metrics.health.dormantClubs"
          :median-days-to-first-review="metrics.health.medianDaysToFirstReview"
          :days-to-first-review-sample="metrics.health.daysToFirstReviewSample"
        />

        <SignupSourceWidget
          :signup-methods="metrics.health.signupMethods"
          :unverified-users="metrics.health.unverifiedUsers"
        />
      </section>

      <section class="space-y-4">
        <h2 class="mx-auto w-11/12 text-sm font-bold uppercase tracking-wide text-slate-400">
          Who
        </h2>
        <TopUsersWidget :users="metrics.topUsers" />
        <TopClubsWidget :clubs="metrics.topClubs" />
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import axios from "axios";
import { computed, ref } from "vue";

import ClubHealthWidget from "../components/ClubHealthWidget.vue";
import EngagementWidget from "../components/EngagementWidget.vue";
import GrowthWidget from "../components/GrowthWidget.vue";
import KpiTile from "../components/KpiTile.vue";
import RateTile from "../components/RateTile.vue";
import SignupSourceWidget from "../components/SignupSourceWidget.vue";
import SnapshotHistoryWidget from "../components/SnapshotHistoryWidget.vue";
import TopClubsWidget from "../components/TopClubsWidget.vue";
import TopUsersWidget from "../components/TopUsersWidget.vue";
import {
  deltaOverDays,
  formatCount,
  formatRelativeTime,
  percentOf,
  rateFraction,
  ratePercent,
  stickiness,
} from "../formatMetrics";
import { type HistoryWindow } from "../historyWindow";
import { useAdminMetrics, useAdminMetricsHistory } from "@/service/useAdminMetrics";

/** Window the KPI deltas compare against. */
const DELTA_DAYS = 7;

const historyWindow = ref<HistoryWindow>("90");
const historyDays = computed(() => Number(historyWindow.value));

const { data: metrics, isLoading, isError, isFetching, error, refetch } = useAdminMetrics();
const { data: history } = useAdminMetricsHistory(historyDays);

/**
 * A 401 is the expected answer for everyone who isn't on the allowlist, so it
 * gets a plain explanation rather than the generic failure state. Authorization
 * lives entirely on the API — the route itself is not access-controlled, so this
 * is where a non-admin finds out.
 */
const isUnauthorized = computed(
  () => axios.isAxiosError(error.value) && error.value.response?.status === 401,
);

const generatedLabel = computed(() =>
  metrics.value === undefined ? "unknown" : formatRelativeTime(metrics.value.generatedAt),
);

const stickinessPercent = computed(() =>
  metrics.value === undefined ? null : stickiness(metrics.value.engagedUsers),
);

/**
 * Week-over-week movement for the running totals, read out of the snapshot
 * history rather than queried — the daily job already stores these three.
 *
 * Only those three: memberships and works aren't in the snapshot's narrow
 * compatibility schema, so their tiles show no delta rather than a wrong one.
 */
const deltas = computed(() => {
  const totals = metrics.value?.totals;
  const points = history.value ?? [];
  if (totals === undefined) {
    return { users: null, clubs: null, reviews: null };
  }
  return {
    users: deltaOverDays(points, "users", totals.users, DELTA_DAYS),
    clubs: deltaOverDays(points, "clubs", totals.clubs, DELTA_DAYS),
    reviews: deltaOverDays(points, "reviews", totals.reviews, DELTA_DAYS),
  };
});
</script>
