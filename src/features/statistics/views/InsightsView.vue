<template>
  <div class="space-y-6 pb-6">
    <StatsWidget :work-data="workData" :club-type="clubType" />
    <ClubRecordsWidget :work-data="workData" />

    <ScoreChartsWidget
      :work-data="workData"
      :members="members"
      :histogram-data="histogramData"
    />
    <ActivityWidget :work-data="workData" :club-type="clubType" />

    <GenresWidget
      v-if="isMovieClub"
      :movie-data="movieData"
      :members="members"
    />
    <SubjectStatsWidget v-if="isBookClub" :book-data="bookData" />
    <EraWidget :work-data="workData" :members="members" :club-type="clubType" />
    <PeopleWidget v-if="isMovieClub" :movie-data="movieData" />
    <AuthorLeaderboardWidget v-if="isBookClub" :book-data="bookData" />

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
    <MemberOutliersWidget
      v-if="members.length > 1"
      :work-data="workData"
      :members="members"
      :club-type="clubType"
    />

    <ClubConsensusWidget :work-data="workData" :members="members" />
    <TmdbDeviationWidget v-if="isMovieClub" :movie-data="movieData" />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

import { Member } from "../../../../lib/types/club";
import { ClubType } from "../../../../lib/types/generated/db";
import ActivityWidget from "../components/ActivityWidget.vue";
import AuthorLeaderboardWidget from "../components/AuthorLeaderboardWidget.vue";
import ClubConsensusWidget from "../components/ClubConsensusWidget.vue";
import ClubRecordsWidget from "../components/ClubRecordsWidget.vue";
import EraWidget from "../components/EraWidget.vue";
import GenresWidget from "../components/GenresWidget.vue";
import MemberOutliersWidget from "../components/MemberOutliersWidget.vue";
import PeopleWidget from "../components/PeopleWidget.vue";
import ReviewerLeaderboardWidget from "../components/ReviewerLeaderboardWidget.vue";
import ScoreChartsWidget from "../components/ScoreChartsWidget.vue";
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
// for the matching club type: genres/TMDB for movies, subjects/authors for
// books. Era and activity widgets are media-agnostic and take workData.
const movieData = computed(() => props.workData.filter(isMovieStats));
const bookData = computed(() => props.workData.filter(isBookStats));
</script>
