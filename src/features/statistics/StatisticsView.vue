<template>
  <div>
    <page-header
      :has-back="true"
      back-route="ClubHome"
      page-name="Statistics"
    />
    <loading-spinner v-if="loading" />

    <div class="flex items-center justify-center sticky top-0 z-50 bg-background py-4">
      <div class="w-11/12 relative flex gap-4">
        <div class="flex-1 relative">
          <mdicon
            name="magnify"
            class="absolute pl-4 top-1/2 -translate-y-1/2 transform text-slate-200"
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
          >{{ normButtonText }}</v-btn>
          <div
            v-if="showTooltip"
            class="absolute z-10 p-2 bg-gray-800 text-sm text-gray-300 rounded-md shadow-lg -left-64 top-12 w-72"
          >
            Normalizing scores adjusts each member's ratings to account for their different scoring patterns. 
            A normalized score of 0 means average, while lower and higher values indicate scores below and above your usual rating.
          </div>
        </div>
      </div>
    </div>

    <div v-if="!loading">
      <br />
      <ag-charts-vue :options="histChartOptions"></ag-charts-vue>
      <br />
      <ag-charts-vue :options="scoreChartOptions"></ag-charts-vue>
      <br />
      <ag-charts-vue :options="budgetChartOptions"></ag-charts-vue>
      <br />
      <ag-charts-vue :options="revenueChartOptions"></ag-charts-vue>
      <br />
      <ag-charts-vue :options="dateChartOptions"></ag-charts-vue>
      <br />
      <ag-charts-vue :options="genreChartOptions"></ag-charts-vue>
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
import { AgHistogramSeriesTooltipRendererParams, AgBarSeriesTooltipRendererParams } from "ag-charts-community";
import { AgChartsVue } from "ag-charts-vue3";
import { DateTime } from "luxon";
import { ref, computed, watch, h } from "vue";
import { filterMovies } from '@/common/searchMovies';
import VAvatar from "@/common/components/VAvatar.vue";
import AverageImg from "@/assets/images/average.svg";
import MovieTooltip from "@/features/reviews/components/MovieTooltip.vue";
import {
  createColumnHelper,
  getCoreRowModel,
  getSortedRowModel,
  useVueTable,
} from "@tanstack/vue-table";
import TableView from "@/features/reviews/components/TableView.vue";

import {
  normalizeArray,
  loadDefaultChartSettings,
  createHistogramData,
} from "./StatisticsUtils";

import { Header } from "@/common/types/common";
import { WorkListType } from "@/common/types/generated/db";
import { DetailedReviewListItem } from "@/common/types/lists";
import { useMembers, useClub, useClubId } from "@/service/useClub";
import { useList } from "@/service/useList";

const clubId = useClubId();
const { isLoading: loadingClub, data: club } = useClub(clubId);
const { isLoading: loadingReviews, data: reviews } = useList(
  clubId,
  WorkListType.reviews,
);
const { isLoading: loadingMembers, data: rawMembers } = useMembers(clubId);
const members = computed(() => rawMembers.value ?? []);

const clubName = computed(() => club.value?.clubName ?? "Club");
const normButtonText = ref("Normalize Scores");

const loadingCalculations = ref(true);

const normalize = ref(false);
const movieData = ref<any[]>([]);
const selectedChartBase = ref("average");
const selectedChartMeasure = ref("runtime");
const histogramData = ref<any[]>([]);
const histogramNormData = ref<any[]>([]);

const scoreChartOptions = ref({});
const revenueChartOptions = ref({});
const budgetChartOptions = ref({});
const customChartOptions = ref({});
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

const filteredMovieData = computed(() => {
  return filterMovies(movieData.value, searchTerm.value);
});

const fetchMovieData = (reviews: DetailedReviewListItem[]) => {
  return reviews.map((review) => {
    if (!review.externalData) return null;
    
    return {
      title: review.title,
      dateWatched: DateTime.fromISO(review.createdDate).toLocaleString(),
      ...Object.keys(review.scores).reduce<Record<string, number>>(
        (acc, key) => {
          acc[key] = review.scores[key].score ?? 0;
          return acc;
        },
        {},
      ),
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
  }).filter(Boolean); // Remove any null entries
};

const generateCustomChart = () => {
  customChartOptions.value = loadDefaultChartSettings({
    chartTitle:
      "Custom chart: " +
      selectedChartBase.value +
      " vs " +
      selectedChartMeasure.value,
    xName: selectedChartMeasure.value,
    xData: selectedChartMeasure.value,
    yName: selectedChartBase.value,
    yData: selectedChartBase.value,
    movieData: movieData.value,
    normalizeX: false,
    normalizeY: false,
    normalizeToggled: normalize.value
  });
};
const generateGenreChart = () => {
  // Aggregate scores by genre
  const genreScores = movieData.value.reduce((acc, movie) => {
    movie.genres.forEach((genre: string) => {
      if (movie.average) {
        if (!acc[genre]) {
          acc[genre] = { count: 0, totalScore: 0 };
        }
        acc[genre].count++;
        acc[genre].totalScore += movie.average ?? 0;
      }
    });
    return acc;
  }, {} as Record<string, { count: number; totalScore: number }>);

  const genreData = Object.entries(genreScores as Record<string, { count: number; totalScore: number }>)
    .map(([genre, data]) => ({
      genre,
      averageScore: (data.totalScore ?? 0) / (data.count ?? 1),
      count: data.count ?? 0,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    autoSize: true,
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
          renderer: function (params: AgBarSeriesTooltipRendererParams) {
            return (
              '<div class="ag-chart-tooltip-title" ' +
              'style="background-color:' +
              params.color +
              '">' +
              params.datum.genre +
              "</div>" +
              '<div class="ag-chart-tooltip-content">' +
              params.xName +
              ": " +
              params.xValue +
              "</br>" +
              params.yName +
              ": " +
              params.yValue +
              "</br>" +
              "Count: " +
              params.datum.count +
              "</div>"
            );
          },
        },
      },
    ]
  };
};

const availableMetrics = computed(() => {
  if (!movieData.value?.[0]) return [];
  return Object.keys(movieData.value[0]).filter(key => 
    typeof movieData.value[0][key] === 'number' ||
    (typeof movieData.value[0][key] === 'string' && !isNaN(Number(movieData.value[0][key])))
  );
});

watch(selectedChartMeasure, generateCustomChart);
watch(selectedChartBase, generateCustomChart);

const loadChartOptions = async () => {
  try {
    chartLoadingStates.value.histogram = true;
    // Filter the histogram data based on the filtered movies
    const filteredHistData = histogramData.value.map(bin => {
      const filtered = { ...bin };
      members.value.forEach(member => {
        filtered[member.id] = 0;
      });
      return filtered;
    });
    const filteredHistNormData = histogramNormData.value.map(bin => {
      const filtered = { ...bin };
      members.value.forEach(member => {
        filtered[member.id] = 0;
      });
      return filtered;
    });

    // Populate the filtered histogram data
    filteredMovieData.value.forEach(movie => {
      members.value.forEach(member => {
        const score = Math.floor(movie[member.id]);
        if (!isNaN(score)) {
          filteredHistData[score][member.id] += 1;
        }
        let scoreNorm = Math.floor(movie[member.id + "Norm"] * 4 + 5);
        scoreNorm = scoreNorm < 0 ? 0 : scoreNorm > 10 ? 10 : scoreNorm;
        filteredHistNormData[scoreNorm][member.id] += 1;
      });
    });

    histChartOptions.value = {
      autoSize: true,
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
            renderer: function (params: AgHistogramSeriesTooltipRendererParams) {
              return (
                '<div class="ag-chart-tooltip-title" ' +
                'style="background-color:' +
                params.color +
                '">' +
                members.value.find(member => member.id === params.yKey)?.name +
                "</div>" +
                '<div class="ag-chart-tooltip-content">' +
                params.xName +
                ": " +
                params.xValue +
                "</br>" +
                params.yName +
                ": " +
                params.yValue +
                "</div>"
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
    const validTMDBData = filteredMovieData.value.filter(movie => 
      movie.vote_average && movie.vote_average > 0 && 
      movie.average && movie.average > 0
    );
    
    scoreChartOptions.value = loadDefaultChartSettings({
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

    budgetChartOptions.value = loadDefaultChartSettings({
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

    revenueChartOptions.value = loadDefaultChartSettings({
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

    dateChartOptions.value = loadDefaultChartSettings({
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
    console.error('Error loading charts:', error);
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
    movieData.value.map((data) => parseFloat(data["vote_average"])),
  );
  for (const member of members.value) {
    memberScores[member.id] = normalizeArray(
      movieData.value.map((data) => data[member.id]),
    );
    for (let i = 0; i <= 10; i++) {
      histogramData.value[i][member.id] = 0;
      histogramNormData.value[i][member.id] = 0;
    }
  }

  for (let i = 0; i < movieData.value.length; i++) {
    let avg = 0;
    for (const member of members.value) {
      movieData.value[i][member.id + "Norm"] = memberScores[member.id][i];
      avg += memberScores[member.id][i];

      // Histogram
      const score = Math.floor(movieData.value[i][member.id]);
      if (isNaN(score)) continue;
      histogramData.value[score][member.id] += 1;
      let scoreNorm = Math.floor(
        movieData.value[i][member.id + "Norm"] * 4 + 5,
      );
      scoreNorm = scoreNorm < 0 ? 0 : scoreNorm > 10 ? 10 : scoreNorm;
      histogramNormData.value[scoreNorm][member.id] += 1;
    }
    avg = avg / members.value.length;

    movieData.value[i]["averageNorm"] = Math.round(avg * 100) / 100;
    movieData.value[i]["vote_average"] = parseFloat(movieData.value[i]["vote_average"]);
    movieData.value[i]["release_year"] = movieData.value[i]["release_date"] 
      ? parseInt(movieData.value[i]["release_date"].substring(0, 4))
      : null;
    movieData.value[i]["revenueMil"] = (movieData.value[i]["revenue"] ?? 0) / 1000000;
    movieData.value[i]["budgetMil"] = (movieData.value[i]["budget"] ?? 0) / 1000000;
    movieData.value[i]["vote_averageNorm"] = tmbd_norm[i];
  }
  loadChartOptions();
  generateCustomChart();
  loadingCalculations.value = false;
};

const setReviews = (isLoading: boolean) => {
  if (isLoading) return;
  movieData.value = fetchMovieData(reviews.value ?? []);
  console.log(movieData.value);
  calculateStatistics();
};

watch(loadingReviews, setReviews);
setReviews(loadingReviews.value);

const toggle = () => {
  normalize.value = !normalize.value;
  normButtonText.value = normalize.value
    ? "Denormalize Scores"
    : "Normalize Scores";
  loadChartOptions();
};

const normName = (name = "average") => {
  return normalize.value ? name + "Norm" : name;
};

const headers = computed(() => {
  const headers: Header[] = [
    { value: "title", style: "font-bold", title: "Title" },
    { value: "dateWatched", title: "Date Reviewed" },
  ];

  if (members.value && members.value.length > 0) {
    for (const member of members.value) {
      headers.push({ value: member.id + (normalize.value ? "Norm" : "") });
    }
  }
  headers.push({ value: "average" + (normalize.value ? "Norm" : "") });
  headers.push({
    value: "vote_average",
    title: "TMDB",
  });
  return headers;
});

// Add a watch on filteredMovieData to trigger chart updates
watch(filteredMovieData, () => {
  if (filteredMovieData.value) {
    loadChartOptions();
  }
}, { immediate: true });

const columnHelper = createColumnHelper<any>();

const columns = computed(() => [
  columnHelper.accessor("title", {
    header: "Title",
    cell: (info) => h(MovieTooltip, {
      title: info.getValue(),
      imageUrl: info.row.original.imageUrl,
      movie: info.row.original.externalData
    }),
    meta: {
      class: "font-bold",
    },
  }),
  columnHelper.accessor("dateWatched", {
    header: "Date Reviewed",
  }),
  ...members.value.map((member) =>
    columnHelper.accessor(normName(member.id), {
      id: normName(member.id),
      header: () => h(VAvatar, {
        src: member.image,
        name: member.name,
      }),
      cell: (info) => {
        const value = info.getValue();
        return value !== undefined ? Math.round(value * 100) / 100 : '';
      },
      sortUndefined: "last",
    }),
  ),
  columnHelper.accessor(normName(), {
    header: () => h("img", { 
      src: AverageImg, 
      class: "h-12 w-16 max-w-none" 
    }),
    cell: (info) => {
      const value = info.getValue();
      return value !== undefined ? Math.round(value * 100) / 100 : '';
    },
    sortUndefined: "last",
  }),
  columnHelper.accessor("vote_average", {
    header: "TMDB",
    cell: (info) => {
      const value = info.getValue();
      return value !== undefined ? Math.round(value * 100) / 100 : '';
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
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getRowId: (row) => row.title,
});
</script>
