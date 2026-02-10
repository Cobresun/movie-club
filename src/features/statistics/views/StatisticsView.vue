<template>
  <div>
    <page-header :has-back="true" back-route="ClubHome" page-name="Statistics">
      <div v-if="!loading && hasReviews" class="flex gap-2">
        <mdicon name="view-dashboard" />
        <VToggle v-model="showScoresView" />
        <mdicon name="table" />
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
      <!-- Insights view -->
      <template v-if="!showScoresView">
        <StatsWidget
          :total-movies="totalMovies"
          :total-runtime-minutes="totalRuntimeMinutes"
        />
        <br />
        <ScoreDistributionWidget :options="histChartOptions" />
        <br />
        <GenreStatsWidget :members="members" :movie-data="movieData" />
        <br />
        <ReviewerLeaderboardWidget :leaderboard="memberLeaderboard" />
        <br />
        <TasteSimilarityWidget
          :most-similar="tasteSimilarity.mostSimilar"
          :least-similar="tasteSimilarity.leastSimilar"
        />
        <br />
        <DirectorsLeaderboard :movie-data="movieData" />
      </template>

      <!-- Scores view -->
      <template v-else>
        <StatisticsSearchBar v-model="searchTerm" />

        <div class="mb-4 flex flex-wrap items-center gap-4 px-2">
          <div class="flex items-center gap-2">
            <v-switch
              :model-value="showScoreContext"
              color="primary"
              @update:model-value="toggleScoreContext"
            />
            <span class="text-sm text-gray-300">Show Score Context</span>
          </div>
          <div
            v-if="showScoreContext"
            class="flex items-center gap-2 text-xs text-gray-400"
          >
            <span>Below their usual</span>
            <div class="flex h-5 overflow-hidden rounded">
              <div
                class="w-6"
                :style="{ background: 'rgba(239, 68, 68, 0.45)' }"
              ></div>
              <div
                class="w-6"
                :style="{ background: 'rgba(239, 68, 68, 0.22)' }"
              ></div>
              <div
                class="w-6 border border-gray-600"
                :style="{ background: 'transparent' }"
              ></div>
              <div
                class="w-6"
                :style="{ background: 'rgba(34, 197, 94, 0.22)' }"
              ></div>
              <div
                class="w-6"
                :style="{ background: 'rgba(34, 197, 94, 0.45)' }"
              ></div>
            </div>
            <span>Above their usual</span>
          </div>
        </div>

        <EmptyState
          v-if="hasSearchTerm && filteredMovieData.length === 0"
          title="No Movies Found"
          description="Try adjusting your search or filters. You can search by title, genre, company, or release year"
        />
        <table-view v-else :review-table="movieTable" />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  createColumnHelper,
  getCoreRowModel,
  getSortedRowModel,
  useVueTable,
} from "@tanstack/vue-table";
import { computed, h, ref } from "vue";
import { useRouter } from "vue-router";

import { createHistogramOptions } from "../chartOptions";
import DirectorsLeaderboard from "../components/DirectorsLeaderboard.vue";
import GenreStatsWidget from "../components/GenreStatsWidget.vue";
import ReviewerLeaderboardWidget from "../components/ReviewerLeaderboardWidget.vue";
import ScoreDistributionWidget from "../components/ScoreDistributionWidget.vue";
import StatisticsSearchBar from "../components/StatisticsSearchBar.vue";
import StatsWidget from "../components/StatsWidget.vue";
import TasteSimilarityWidget from "../components/TasteSimilarityWidget.vue";
import { useStatisticsData } from "../composables/useStatisticsData";
import {
  computeMemberLeaderboard,
  computeTasteSimilarity,
  getScoreContextColor,
  MovieStatistics,
} from "../StatisticsUtils";

import AverageImg from "@/assets/images/average.svg";
import EmptyState from "@/common/components/EmptyState.vue";
import VAvatar from "@/common/components/VAvatar.vue";
import VToggle from "@/common/components/VToggle.vue";
import MovieTooltip from "@/features/reviews/components/MovieTooltip.vue";
import TableView from "@/features/reviews/components/TableView.vue";

const {
  loading,
  movieData,
  filteredMovieData,
  members,
  histogramData,
  searchTerm,
  showScoreContext,
  totalMovies,
  totalRuntimeMinutes,
  hasReviews,
  hasSearchTerm,
  toggleScoreContext,
} = useStatisticsData();

const showScoresView = ref(false);

const router = useRouter();

const navigateToReviews = () => {
  router.push({ name: "Reviews" }).catch(console.error);
};

const histChartOptions = computed(() =>
  createHistogramOptions({
    filteredMovieData: filteredMovieData.value,
    histogramData: histogramData.value,
    members: members.value,
  }),
);

const memberLeaderboard = computed(() =>
  computeMemberLeaderboard(movieData.value, members.value),
);

const tasteSimilarity = computed(() =>
  computeTasteSimilarity(movieData.value, members.value),
);

const columnHelper = createColumnHelper<MovieStatistics>();

const columns = computed(() => [
  columnHelper.accessor("title", {
    header: "Title",
    cell: (info) =>
      h(MovieTooltip, {
        title: info.getValue(),
        imageUrl: info.row.original.imageUrl,
        movie: info.row.original.externalData,
      }),
    meta: {
      class: "font-bold",
    },
  }),
  columnHelper.accessor("dateWatched", {
    header: "Date Reviewed",
  }),
  ...members.value.map((member) =>
    columnHelper.accessor((row) => row.userScores[member.id], {
      id: member.id,
      header: () =>
        h(VAvatar, {
          src: member.image,
          name: member.name,
        }),
      cell: (info) => {
        const value = info.getValue();
        if (value === undefined) return "";
        const display = Math.round(value * 100) / 100;

        if (!showScoreContext.value) return String(display);

        const zScore = info.row.original.normalized[member.id];
        const bgColor = getScoreContextColor(zScore);
        return h(
          "div",
          {
            class: "rounded-md px-2 py-1 text-center",
            style: { backgroundColor: bgColor },
          },
          String(display),
        );
      },
      sortUndefined: "last",
    }),
  ),
  columnHelper.accessor("average", {
    header: () =>
      h("img", {
        src: AverageImg,
        class: "h-12 w-16 max-w-none",
      }),
    cell: (info) => {
      const value = info.getValue();
      return value !== undefined ? Math.round(value * 100) / 100 : "";
    },
    sortUndefined: "last",
  }),
  columnHelper.accessor("vote_average", {
    header: "TMDB",
    cell: (info) => {
      const value = info.getValue();
      return value !== undefined ? Math.round(value * 100) / 100 : "";
    },
  }),
]);

const movieTable = useVueTable({
  get columns() {
    return columns.value;
  },
  get data() {
    return filteredMovieData.value ?? [];
  },
  getCoreRowModel: getCoreRowModel<MovieStatistics>(),
  getSortedRowModel: getSortedRowModel<MovieStatistics>(),
  getRowId: (row) => row.id,
});
</script>
