<template>
  <div class="space-y-6">
    <StatsWidget :movie-data="movieData" />
    <ScoreDistributionWidget
      :movie-data="movieData"
      :members="members"
      :histogram-data="histogramData"
    />
    <GenreStatsWidget :movie-data="movieData" :members="members" />
    <ReviewerLeaderboardWidget :movie-data="movieData" :members="members" />
    <TasteSimilarityWidget :movie-data="movieData" :members="members" />
    <DirectorsLeaderboard :movie-data="movieData" />
  </div>
</template>

<script setup lang="ts">
import { Member } from "../../../../lib/types/club";
import DirectorsLeaderboard from "../components/DirectorsLeaderboard.vue";
import GenreStatsWidget from "../components/GenreStatsWidget.vue";
import ReviewerLeaderboardWidget from "../components/ReviewerLeaderboardWidget.vue";
import ScoreDistributionWidget from "../components/ScoreDistributionWidget.vue";
import StatsWidget from "../components/StatsWidget.vue";
import TasteSimilarityWidget from "../components/TasteSimilarityWidget.vue";
import type { HistogramData, MovieData } from "../types";

defineProps<{
  movieData: MovieData[];
  members: Member[];
  histogramData: HistogramData[];
}>();
</script>
