<template>
  <div>
    <page-header
      :has-back="true"
      back-route="ClubHome"
      page-name="Statistics"
    />
    <loading-spinner v-if="loading" />

    <div
      v-if="hasMovieData || hasSearchTerm"
      class="sticky top-0 z-50 flex items-center justify-center bg-background py-4"
    >
      <div class="relative flex w-11/12 gap-4">
        <div class="relative flex-1">
          <mdicon
            name="magnify"
            class="absolute top-1/2 -translate-y-1/2 transform pl-4 text-slate-200"
          />
          <input
            ref="searchInput"
            v-model="searchTerm"
            class="w-full rounded-md border-2 border-slate-600 bg-background p-2 pl-12 text-base text-white outline-none focus:border-primary"
            placeholder="Search (e.g. 'matrix', 'genre:Action', 'year:2024', 'company:Marvel')"
          />
        </div>
        <div class="relative">
          <v-btn
            class="ui button h-full"
            @click="toggle"
            @mouseenter="showTooltip = true"
            @mouseleave="showTooltip = false"
            >{{ normalize ? "Denormalize Scores" : "Normalize Scores" }}</v-btn
          >
          <div
            v-if="showTooltip"
            class="absolute -left-64 top-12 z-10 w-72 rounded-md bg-gray-800 p-2 text-sm text-gray-300 shadow-lg"
          >
            Normalizing scores adjusts each member's ratings to account for
            their different scoring patterns. A normalized score of 0 means
            average, while lower and higher values indicate scores below and
            above your usual rating.
          </div>
        </div>
      </div>
    </div>

    <EmptyState
      v-if="showEmptyState"
      :title="hasSearchTerm ? 'No Movies Found' : 'No Statistics Yet'"
      :description="
        hasSearchTerm
          ? 'Try adjusting your search. You can search by title, genre, company, or release year'
          : 'Add reviews to start seeing statistics and insights about your club\'s movie ratings'
      "
      :action-label="hasSearchTerm ? 'Clear Search' : 'Go to Reviews'"
      :action-icon="hasSearchTerm ? undefined : 'arrow-right'"
      @action="handleEmptyStateAction"
    />

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

      <!-- <v-select
        v-model="selectedChartBase"
        :items="headers.map((header) => header.value)"
        hint="Select the Y-axis metric"
        persistent-hint
      />
      <v-select
        v-model="selectedChartMeasure"
        :items="availableMetrics"
        hint="Select the X-axis metric"
        persistent-hint
      />
      <br />
      <ag-charts-vue :options="customChartOptions"></ag-charts-vue>
      <br /> -->
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
import {
  AgBarSeriesTooltipRendererParams,
  AgLineSeriesTooltipRendererParams,
} from "ag-charts-community";
import { AgCharts } from "ag-charts-vue3";
import { DateTime } from "luxon";
import { ref, computed, watch, h } from "vue";
import { useRouter } from "vue-router";

import {
  normalizeArray,
  loadScatterChartSettings,
  createHistogramData,
  MovieStatistics,
  HistogramData,
} from "./StatisticsUtils";
import { isDefined, isString } from "../../../lib/checks/checks.js";
import { WorkListType, WorkType } from "../../../lib/types/generated/db";
import { DetailedReviewListItem } from "../../../lib/types/lists";

import AverageImg from "@/assets/images/average.svg";
import VAvatar from "@/common/components/VAvatar.vue";
import { filterMovies } from "@/common/searchMovies";
import MovieTooltip from "@/features/reviews/components/MovieTooltip.vue";
import TableView from "@/features/reviews/components/TableView.vue";
import { useMembers, useClub, useClubId } from "@/service/useClub";
import { useList } from "@/service/useList";

const router = useRouter();
const clubId = useClubId();
const { isLoading: loadingClub, data: club } = useClub(clubId);
const { isLoading: loadingReviews, data: reviews } = useList(
  clubId,
  WorkListType.reviews,
);
const { isLoading: loadingMembers, data: rawMembers } = useMembers(clubId);
const members = computed(() => rawMembers.value ?? []);

const clubName = computed(() => club.value?.clubName ?? "Club");
const loadingCalculations = ref(true);

const normalize = ref(false);
const movieData = ref<MovieStatistics[]>([]);
// TODO: fix custom chart
// const selectedChartBase = ref("average");
// const selectedChartMeasure = ref("runtime");
const histogramData = ref<HistogramData[]>([]);
const histogramNormData = ref<HistogramData[]>([]);

const scoreChartOptions = ref({});
const revenueChartOptions = ref({});
const budgetChartOptions = ref({});
// TODO: fix custom chart
// const customChartOptions = ref({});
const dateChartOptions = ref({});
const histChartOptions = ref({});
const genreChartOptions = ref({});

const chartLoadingStates = ref({
  histogram: true,
  score: true,
  budget: true,
  revenue: true,
  date: true,
  genre: true,
  custom: true,
});

const loading = computed(
  () =>
    loadingReviews.value ||
    loadingMembers.value ||
    loadingClub.value ||
    loadingCalculations.value,
);

const searchTerm = ref("");
const searchInput = ref<HTMLInputElement | null>(null);
const showTooltip = ref(false);

const hasSearchTerm = computed(() => searchTerm.value.trim().length > 0);
const hasMovieData = computed(() => movieData.value.length > 0);

const goToReviews = () => {
  router.push({ name: "Reviews", params: { clubId } });
};

const handleEmptyStateAction = () => {
  if (hasSearchTerm.value) {
    searchTerm.value = "";
  } else {
    goToReviews();
  }
};

const filteredMovieData = computed(() => {
  return filterMovies(movieData.value, searchTerm.value);
});

const showEmptyState = computed(
  () => !loading.value && filteredMovieData.value.length === 0,
);

const fetchMovieData = (
  reviews: DetailedReviewListItem[],
): MovieStatistics[] => {
  return reviews
    .map((review) => {
      if (!review.externalData) return null;

      return {
        id: review.id,
        type: WorkType.movie,
        title: review.title,
        dateWatched: DateTime.fromISO(review.createdDate).toLocaleString(),
        userScores: Object.keys(review.scores).reduce<Record<string, number>>(
          (acc, key) => {
            acc[key] = review.scores[key].score ?? 0;
            return acc;
          },
          {},
        ),
        scores: review.scores,
        average: review.scores.average?.score ?? 0,
        normalized: {},
        // Map the new external data structure
        imageUrl: review.imageUrl,
        createdDate: review.createdDate,
        vote_average: review.externalData.vote_average,
        revenue: review.externalData.revenue,
        budget: review.externalData.budget,
        release_date: review.externalData.release_date,
        genres: review.externalData.genres,
        production_companies: review.externalData.production_companies,
        production_countries: review.externalData.production_countries,
        externalData: review.externalData,
      };
    })
    .filter(isDefined); // Remove any null entries
};

// TODO: fix custom chart
// const generateCustomChart = () => {
//   customChartOptions.value = loadScatterChartSettings({
//     chartTitle:
//       "Custom chart: " +
//       selectedChartBase.value +
//       " vs " +
//       selectedChartMeasure.value,
//     xName: selectedChartMeasure.value,
//     xData: selectedChartMeasure.value,
//     yName: selectedChartBase.value,
//     yData: selectedChartBase.value,
//     movieData: movieData.value,
//     normalizeX: false,
//     normalizeY: false,
//     normalizeToggled: normalize.value,
//   });
// };

const generateGenreChart = () => {
  // Aggregate scores by genre
  const genreScores = movieData.value.reduce<
    Partial<Record<string, { count: number; totalScore: number }>>
  >((acc, movie) => {
    movie.genres.forEach((genre: string) => {
      if (movie.average !== 0) {
        let details = acc[genre];
        if (!details) {
          details = { count: 0, totalScore: 0 };
          acc[genre] = details;
        }
        details.count++;
        details.totalScore += movie.average ?? 0;
      }
    });
    return acc;
  }, {});

  const genreData = Object.entries(
    genreScores as Record<string, { count: number; totalScore: number }>,
  )
    .map(([genre, data]) => ({
      genre,
      averageScore: (data.totalScore ?? 0) / (data.count ?? 1),
      count: data.count ?? 0,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    theme: "ag-default-dark",
    title: { text: `Scores for Top 8 Genres` },
    data: genreData.slice(0, 8),
    series: [
      {
        type: "bar",
        xKey: "genre",
        xName: "Genre",
        yKey: "averageScore",
        yName: "Average Score",
        showInLegend: false,
        tooltip: {
          renderer: function (
            params: AgBarSeriesTooltipRendererParams<{
              genre: string;
              averageScore: number;
              count: number;
            }>,
          ) {
            return (
              `<div class="ag-chart-tooltip-title p-2" style="background-color:${params.fill}">${params.datum.genre}</div>` +
              `<div class="ag-chart-tooltip-content p-2 text-start">` +
              `${params.xName}: ${params.datum.genre}` +
              `</br>` +
              `${params.yName}: ${params.datum.averageScore}` +
              "</br>" +
              `Count: ${params.datum.count}` +
              "</div>"
            );
          },
        },
      },
    ],
  };
};

// TODO: fix custom chart
// const availableMetrics = computed(() => {
//   if (!movieData.value?.[0]) return [];
//   return Object.keys(movieData.value[0]).filter(
//     (key) =>
//       typeof movieData.value[0][key] === "number" ||
//       (typeof movieData.value[0][key] === "string" &&
//         !isNaN(Number(movieData.value[0][key]))),
//   );
// });

// watch(selectedChartMeasure, generateCustomChart);
// watch(selectedChartBase, generateCustomChart);

const loadChartOptions = () => {
  try {
    chartLoadingStates.value.histogram = true;
    // Filter the histogram data based on the filtered movies
    const filteredHistData = histogramData.value.map((bin) => {
      const filtered = { ...bin };
      members.value.forEach((member) => {
        filtered[member.id] = 0;
      });
      return filtered;
    });
    const filteredHistNormData = histogramNormData.value.map((bin) => {
      const filtered = { ...bin };
      members.value.forEach((member) => {
        filtered[member.id] = 0;
      });
      return filtered;
    });

    // Populate the filtered histogram data
    filteredMovieData.value.forEach((movie) => {
      members.value.forEach((member) => {
        const score = Math.floor(movie.userScores[member.id]);
        if (!isNaN(score)) {
          filteredHistData[score][member.id] += 1;
        }
        let scoreNorm = Math.floor(movie.normalized[member.id] * 4 + 5);
        scoreNorm = scoreNorm < 0 ? 0 : scoreNorm > 10 ? 10 : scoreNorm;
        filteredHistNormData[scoreNorm][member.id] += 1;
      });
    });

    histChartOptions.value = {
      theme: "ag-default-dark",
      title: { text: "Score Histogram" },
      data: normalize.value ? filteredHistNormData : filteredHistData,
      series: members.value.map((member) => {
        return {
          type: "line",
          xKey: "bin",
          xName: "Score",
          yKey: member.id,
          yName: member.name,
          showInLegend: true,
          tooltip: {
            renderer: function (
              params: AgLineSeriesTooltipRendererParams<HistogramData>,
            ) {
              const name = members.value.find(
                (member) => member.id === params.yKey,
              )?.name;
              return (
                `<div class="ag-chart-tooltip-title">${name}</div>` +
                `<div class="ag-chart-tooltip-content">` +
                `${params.xName}: ${params.datum.bin}` +
                `</br>` +
                `${params.yName}: ${params.datum[member.id]}` +
                `</div>`
              );
            },
          },
        };
      }),
      axes: [
        {
          type: "number",
          position: "bottom",
          title: {
            enabled: true,
            text: "Score",
          },
        },
        {
          type: "number",
          position: "left",
          title: {
            enabled: true,
            text: "Frequency of Score",
          },
        },
      ],
    };
    chartLoadingStates.value.histogram = false;

    // Special handling for TMDB score chart where TMDB score is available
    const validTMDBData = filteredMovieData.value.filter(
      (movie) =>
        isDefined(movie.vote_average) &&
        !isString(movie.vote_average) &&
        movie.vote_average > 0 &&
        isDefined(movie.average) &&
        movie.average > 0,
    );

    scoreChartOptions.value = loadScatterChartSettings({
      chartTitle: "Score vs TMDB Audience Score",
      xName: "TMDB Audience Score",
      xData: "vote_average",
      normalizeX: true,
      yName: clubName.value + " Score",
      yData: "average",
      normalizeY: true,
      normalizeToggled: normalize.value,
      movieData: validTMDBData,
    });

    budgetChartOptions.value = loadScatterChartSettings({
      chartTitle: "Score vs Film Budget (Millions)",
      xName: "Film Budget ($mil)",
      xData: "budgetMil",
      normalizeX: false,
      yName: clubName.value + " Score",
      yData: "average",
      normalizeY: true,
      normalizeToggled: normalize.value,
      movieData: filteredMovieData.value,
    });

    revenueChartOptions.value = loadScatterChartSettings({
      chartTitle: "Score vs Film Revenue (Millions)",
      xName: "Film Revenue ($mil)",
      xData: "revenueMil",
      normalizeX: false,
      yName: clubName.value + " Score",
      yData: "average",
      normalizeY: true,
      normalizeToggled: normalize.value,
      movieData: filteredMovieData.value,
    });

    dateChartOptions.value = loadScatterChartSettings({
      chartTitle: "Score vs Release Date",
      xName: "Date",
      xData: "release_year",
      normalizeX: false,
      yName: clubName.value + " Score",
      yData: "average",
      normalizeY: true,
      normalizeToggled: normalize.value,
      movieData: filteredMovieData.value,
    });

    genreChartOptions.value = generateGenreChart();
  } catch (error) {
    console.error("Error loading charts:", error);
  }
};

const calculateStatistics = () => {
  histogramData.value = createHistogramData(
    movieData.value.map((data) => data.average),
    false,
  );
  histogramNormData.value = createHistogramData(
    movieData.value.map((data) => data.average),
    true,
  );

  const memberScores: Record<string, number[]> = {};
  const tmbd_norm = normalizeArray(
    movieData.value.map((data) =>
      isString(data.vote_average)
        ? parseFloat(data.vote_average)
        : data.vote_average,
    ),
  );
  for (const member of members.value) {
    memberScores[member.id] = normalizeArray(
      movieData.value.map((data) => data.userScores[member.id]),
    );
    for (let i = 0; i <= 10; i++) {
      histogramData.value[i][member.id] = 0;
      histogramNormData.value[i][member.id] = 0;
    }
  }

  for (let i = 0; i < movieData.value.length; i++) {
    let avg = 0;
    for (const member of members.value) {
      movieData.value[i].normalized[member.id] = memberScores[member.id][i];
      avg += memberScores[member.id][i];

      // Histogram
      const score = Math.floor(movieData.value[i].userScores[member.id]);
      if (isNaN(score)) continue;
      histogramData.value[score][member.id] += 1;
      let scoreNorm = Math.floor(
        movieData.value[i].normalized[member.id] * 4 + 5,
      );
      scoreNorm = scoreNorm < 0 ? 0 : scoreNorm > 10 ? 10 : scoreNorm;
      histogramNormData.value[scoreNorm][member.id] += 1;
    }
    avg = avg / members.value.length;

    movieData.value[i].normalized["average"] = Math.round(avg * 100) / 100;
    const curVoteAvg = movieData.value[i]["vote_average"];
    movieData.value[i]["vote_average"] = isString(curVoteAvg)
      ? parseFloat(curVoteAvg)
      : curVoteAvg;
    const releaseDate = movieData.value[i]["release_date"];
    movieData.value[i]["release_year"] = isDefined(releaseDate)
      ? parseInt(releaseDate.substring(0, 4))
      : undefined;
    movieData.value[i]["revenueMil"] =
      (movieData.value[i]["revenue"] ?? 0) / 1000000;
    movieData.value[i]["budgetMil"] =
      (movieData.value[i]["budget"] ?? 0) / 1000000;
    movieData.value[i].normalized["vote_average"] = tmbd_norm[i];
  }
  loadChartOptions();
  // generateCustomChart();
  loadingCalculations.value = false;
};

const setReviews = (isLoading: boolean) => {
  if (isLoading) return;
  movieData.value = fetchMovieData(reviews.value ?? []);
  calculateStatistics();
};

watch(loadingReviews, setReviews);
setReviews(loadingReviews.value);

const toggle = () => {
  normalize.value = !normalize.value;
  loadChartOptions();
};

// TODO: Make chart data computed so we don't need this watch
// Add a watch on filteredMovieData to trigger chart updates
watch(
  filteredMovieData,
  () => {
    loadChartOptions();
  },
  { immediate: true },
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
