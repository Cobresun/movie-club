<template>
  <div>
    <page-header
      :has-back="true"
      back-route="ClubHome"
      page-name="Statistics"
    />
    <loading-spinner v-if="loading" />

    <StatisticsSearchBar
      v-if="!loading && hasReviews"
      v-model="searchTerm"
      :normalize="normalize"
      @toggle="toggleNormalize"
    />

    <div v-if="showEmptyState">
      <EmptyState
        :title="hasSearchTerm ? 'No Movies Found' : 'No Statistics Yet'"
        :description="
          hasSearchTerm
            ? 'Try adjusting your search or filters. You can search by title, genre, company, or release year'
            : 'Statistics will appear once your club has reviewed some movies. Get started by adding your first review!'
        "
        :action-label="hasSearchTerm ? undefined : 'Go to Reviews'"
        :action-icon="hasSearchTerm ? undefined : 'arrow-right'"
        @action="navigateToReviews"
      />
    </div>

    <div v-else-if="!loading">
      <br />
      <ag-charts :options="histChartOptions" />
      <br />
      <ag-charts :options="scoreChartOptions" />
      <br />
      <ag-charts :options="budgetChartOptions" />
      <br />
      <ag-charts :options="revenueChartOptions" />
      <br />
      <ag-charts :options="dateChartOptions" />
      <br />
      <ag-charts :options="genreChartOptions" />
      <br />
      <GenreStatsWidget
        :most-loved="genreStats.mostLoved"
        :least-loved="genreStats.leastLoved"
      />
      <br />

      <table-view :review-table="movieTable" />
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
import { AgCharts } from "ag-charts-vue3";
import { computed, h } from "vue";
import { useRouter } from "vue-router";

import {
  createHistogramOptions,
  createScoreVsTMDBOptions,
  createBudgetOptions,
  createRevenueOptions,
  createDateOptions,
  createGenreOptions,
} from "../chartOptions";
import GenreStatsWidget from "../components/GenreStatsWidget.vue";
import StatisticsSearchBar from "../components/StatisticsSearchBar.vue";
import { useStatisticsData } from "../composables/useStatisticsData";
import { computeGenreStats, MovieStatistics } from "../StatisticsUtils";

import AverageImg from "@/assets/images/average.svg";
import EmptyState from "@/common/components/EmptyState.vue";
import VAvatar from "@/common/components/VAvatar.vue";
import MovieTooltip from "@/features/reviews/components/MovieTooltip.vue";
import TableView from "@/features/reviews/components/TableView.vue";

const {
  loading,
  movieData,
  filteredMovieData,
  members,
  clubName,
  histogramData,
  histogramNormData,
  searchTerm,
  normalize,
  hasReviews,
  hasSearchTerm,
  showEmptyState,
  toggleNormalize,
} = useStatisticsData();

const router = useRouter();

const navigateToReviews = () => {
  router.push({ name: "Reviews" }).catch(console.error);
};

const histChartOptions = computed(() =>
  createHistogramOptions({
    filteredMovieData: filteredMovieData.value,
    histogramData: histogramData.value,
    histogramNormData: histogramNormData.value,
    members: members.value,
    normalize: normalize.value,
  }),
);

const scatterParams = computed(() => ({
  filteredMovieData: filteredMovieData.value,
  clubName: clubName.value,
  normalize: normalize.value,
}));

const scoreChartOptions = computed(() =>
  createScoreVsTMDBOptions(scatterParams.value),
);

const budgetChartOptions = computed(() =>
  createBudgetOptions(scatterParams.value),
);

const revenueChartOptions = computed(() =>
  createRevenueOptions(scatterParams.value),
);

const dateChartOptions = computed(() => createDateOptions(scatterParams.value));

const genreChartOptions = computed(() => createGenreOptions(movieData.value));

const genreStats = computed(() => computeGenreStats(movieData.value));

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
    columnHelper.accessor(
      (row) =>
        normalize.value ? row.normalized[member.id] : row.userScores[member.id],
      {
        id: `${normalize.value ? "normalized." : ""}${member.id}`,
        header: () =>
          h(VAvatar, {
            src: member.image,
            name: member.name,
          }),
        cell: (info) => {
          const value = info.getValue();
          return value !== undefined ? Math.round(value * 100) / 100 : "";
        },
        sortUndefined: "last",
      },
    ),
  ),
  columnHelper.accessor(normalize.value ? "normalized.average" : "average", {
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
  columnHelper.accessor(
    normalize.value ? "normalized.vote_average" : "vote_average",
    {
      header: "TMDB",
      cell: (info) => {
        const value = info.getValue();
        return value !== undefined ? Math.round(value * 100) / 100 : "";
      },
    },
  ),
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
