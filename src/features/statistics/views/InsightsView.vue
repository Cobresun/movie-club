<template>
  <div class="space-y-6 pb-6">
    <StatsWidget :movie-data="movieData" />
    <WatchingPaceWidget :movie-data="movieData" />
    <ScoreDistributionWidget
      :movie-data="movieData"
      :members="members"
      :histogram-data="histogramData"
    />
    <ScoreTrendWidget :movie-data="movieData" :members="members" />
    <GenreStatsWidget :movie-data="movieData" :members="members" />
    <GenreWatchCountWidget :movie-data="movieData" />
    <DecadeStatsWidget :movie-data="movieData" :members="members" />
    <ReviewerLeaderboardWidget
      v-if="members.length > 1"
      :movie-data="movieData"
      :members="members"
    />
    <TasteSimilarityWidget
      v-if="members.length > 2"
      :movie-data="movieData"
      :members="members"
    />
    <ClubConsensusWidget :movie-data="movieData" :members="members" />
    <GuiltyPleasuresWidget
      v-if="members.length > 1"
      :movie-data="movieData"
      :members="members"
    />
    <LeaderboardsWidget :movie-data="movieData" />
    <TmdbDeviationWidget :movie-data="movieData" />
  </div>
</template>

<script setup lang="ts">
import { Member } from "../../../../lib/types/club";
import ClubConsensusWidget from "../components/ClubConsensusWidget.vue";
import DecadeStatsWidget from "../components/DecadeStatsWidget.vue";
import GenreStatsWidget from "../components/GenreStatsWidget.vue";
import GenreWatchCountWidget from "../components/GenreWatchCountWidget.vue";
import GuiltyPleasuresWidget from "../components/GuiltyPleasuresWidget.vue";
import LeaderboardsWidget from "../components/LeaderboardsWidget.vue";
import ReviewerLeaderboardWidget from "../components/ReviewerLeaderboardWidget.vue";
import ScoreDistributionWidget from "../components/ScoreDistributionWidget.vue";
import ScoreTrendWidget from "../components/ScoreTrendWidget.vue";
import StatsWidget from "../components/StatsWidget.vue";
import TasteSimilarityWidget from "../components/TasteSimilarityWidget.vue";
import TmdbDeviationWidget from "../components/TmdbDeviationWidget.vue";
import WatchingPaceWidget from "../components/WatchingPaceWidget.vue";
import type { HistogramData, MovieData } from "../types";

defineProps<{
  movieData: MovieData[];
  members: Member[];
  histogramData: HistogramData[];
}>();
</script>
