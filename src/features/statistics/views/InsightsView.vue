<template>
  <div class="space-y-6 pb-6">
    <StatsWidget :movie-data="movieData" />
    <ScoreDistributionWidget
      :movie-data="movieData"
      :members="members"
      :histogram-data="histogramData"
    />
    <GenreStatsWidget :movie-data="movieData" :members="members" />
    <GenreWatchCountWidget :movie-data="movieData" />
    <DecadeStatsWidget :movie-data="movieData" :members="members" />
    <ReviewerLeaderboardWidget :movie-data="movieData" :members="members" />
    <TasteSimilarityWidget :movie-data="movieData" :members="members" />
    <DirectorsLeaderboard :movie-data="movieData" />
    <TmdbDeviationWidget :movie-data="movieData" />
  </div>
</template>

<script setup lang="ts">
import { Member } from "../../../../lib/types/club";
import DecadeStatsWidget from "../components/DecadeStatsWidget.vue";
import DirectorsLeaderboard from "../components/DirectorsLeaderboard.vue";
import GenreStatsWidget from "../components/GenreStatsWidget.vue";
import GenreWatchCountWidget from "../components/GenreWatchCountWidget.vue";
import ReviewerLeaderboardWidget from "../components/ReviewerLeaderboardWidget.vue";
import ScoreDistributionWidget from "../components/ScoreDistributionWidget.vue";
import StatsWidget from "../components/StatsWidget.vue";
import TasteSimilarityWidget from "../components/TasteSimilarityWidget.vue";
import TmdbDeviationWidget from "../components/TmdbDeviationWidget.vue";
import type { HistogramData, MovieData } from "../types";

defineProps<{
  movieData: MovieData[];
  members: Member[];
  histogramData: HistogramData[];
}>();
</script>
