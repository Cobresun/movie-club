<template>
  <div class="grid grid-cols-1 gap-4 px-4 pb-6 sm:grid-cols-2 lg:grid-cols-3 lg:px-6">
    <StatsWidget :movie-data="movieData" />
    <ScoreDistributionWidget
      class="sm:col-span-1 lg:col-span-2"
      :movie-data="movieData"
      :members="members"
      :histogram-data="histogramData"
    />
    <ScoreTrendWidget
      class="sm:col-span-2 lg:col-span-3"
      :movie-data="movieData"
      :members="members"
    />
    <ReviewerLeaderboardWidget
      v-if="members.length > 1"
      :movie-data="movieData"
      :members="members"
    />
    <GenreStatsWidget
      class="sm:col-span-1 lg:col-span-2"
      :movie-data="movieData"
      :members="members"
    />
    <GenreWatchCountWidget
      class="sm:col-span-2 lg:col-span-3"
      :movie-data="movieData"
    />
    <DecadeStatsWidget
      class="sm:col-span-1 lg:col-span-2"
      :movie-data="movieData"
      :members="members"
    />
    <TasteSimilarityWidget
      v-if="members.length > 2"
      class="sm:col-span-2 lg:col-span-3"
      :movie-data="movieData"
      :members="members"
    />
    <ClubConsensusWidget
      class="sm:col-span-2 lg:col-span-3"
      :movie-data="movieData"
      :members="members"
    />
    <GuiltyPleasuresWidget
      v-if="members.length > 1"
      :movie-data="movieData"
      :members="members"
    />
    <ClubCurmudgeonsWidget
      v-if="members.length > 1"
      :movie-data="movieData"
      :members="members"
    />
    <LeaderboardsWidget
      class="sm:col-span-2 lg:col-span-3"
      :movie-data="movieData"
    />
    <TmdbDeviationWidget
      class="sm:col-span-2 lg:col-span-3"
      :movie-data="movieData"
    />
  </div>
</template>

<script setup lang="ts">
import { Member } from "../../../../lib/types/club";
import ClubConsensusWidget from "../components/ClubConsensusWidget.vue";
import ClubCurmudgeonsWidget from "../components/ClubCurmudgeonsWidget.vue";
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
import type { HistogramData, MovieData } from "../types";

defineProps<{
  movieData: MovieData[];
  members: Member[];
  histogramData: HistogramData[];
}>();
</script>
