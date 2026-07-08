<template>
  <div class="space-y-6 pb-6">
    <StatsWidget :work-data="workData" :club-type="clubType" />
    <ScoreDistributionWidget
      :work-data="workData"
      :members="members"
      :histogram-data="histogramData"
    />
    <ScoreTrendWidget :work-data="workData" :members="members" />
    <ScoreVarianceWidget :work-data="workData" />
    <template v-if="isMovieClub">
      <GenreStatsWidget :movie-data="movieData" :members="members" />
      <GenreWatchCountWidget :movie-data="movieData" />
      <DecadeStatsWidget :movie-data="movieData" :members="members" />
      <HighestRatedByYearWidget :movie-data="movieData" />
    </template>
    <template v-if="isBookClub">
      <SubjectStatsWidget :book-data="bookData" />
      <PublishDecadeStatsWidget :book-data="bookData" :members="members" />
    </template>
    <ReviewerLeaderboardWidget
      v-if="members.length > 1"
      :work-data="workData"
      :members="members"
    />
    <TasteSimilarityWidget
      v-if="members.length > 2"
      :work-data="workData"
      :members="members"
    />
    <ClubConsensusWidget :work-data="workData" :members="members" />
    <GuiltyPleasuresWidget
      v-if="members.length > 1"
      :work-data="workData"
      :members="members"
      :club-type="clubType"
    />
    <ClubCurmudgeonsWidget
      v-if="members.length > 1"
      :work-data="workData"
      :members="members"
      :club-type="clubType"
    />
    <template v-if="isMovieClub">
      <LeaderboardsWidget :movie-data="movieData" />
      <TmdbDeviationWidget :movie-data="movieData" />
    </template>
    <AuthorLeaderboardWidget v-if="isBookClub" :book-data="bookData" />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

import { Member } from "../../../../lib/types/club";
import { ClubType } from "../../../../lib/types/generated/db";
import AuthorLeaderboardWidget from "../components/AuthorLeaderboardWidget.vue";
import ClubConsensusWidget from "../components/ClubConsensusWidget.vue";
import ClubCurmudgeonsWidget from "../components/ClubCurmudgeonsWidget.vue";
import DecadeStatsWidget from "../components/DecadeStatsWidget.vue";
import GenreStatsWidget from "../components/GenreStatsWidget.vue";
import GenreWatchCountWidget from "../components/GenreWatchCountWidget.vue";
import GuiltyPleasuresWidget from "../components/GuiltyPleasuresWidget.vue";
import HighestRatedByYearWidget from "../components/HighestRatedByYearWidget.vue";
import LeaderboardsWidget from "../components/LeaderboardsWidget.vue";
import PublishDecadeStatsWidget from "../components/PublishDecadeStatsWidget.vue";
import ReviewerLeaderboardWidget from "../components/ReviewerLeaderboardWidget.vue";
import ScoreDistributionWidget from "../components/ScoreDistributionWidget.vue";
import ScoreTrendWidget from "../components/ScoreTrendWidget.vue";
import ScoreVarianceWidget from "../components/ScoreVarianceWidget.vue";
import StatsWidget from "../components/StatsWidget.vue";
import SubjectStatsWidget from "../components/SubjectStatsWidget.vue";
import TasteSimilarityWidget from "../components/TasteSimilarityWidget.vue";
import TmdbDeviationWidget from "../components/TmdbDeviationWidget.vue";
import {
  isBookStats,
  isMovieStats,
  type HistogramData,
  type WorkStatsData,
} from "../types";

const props = defineProps<{
  workData: WorkStatsData[];
  members: Member[];
  histogramData: HistogramData[];
  clubType: ClubType;
}>();

const isMovieClub = computed(() => props.clubType === ClubType.movie);
const isBookClub = computed(() => props.clubType === ClubType.book);

// Media-specific widgets read metadata off the narrowed slice and only render
// for the matching club type: genres/release dates/TMDB for movies, and
// subjects/authors/publish years for books.
const movieData = computed(() => props.workData.filter(isMovieStats));
const bookData = computed(() => props.workData.filter(isBookStats));
</script>
