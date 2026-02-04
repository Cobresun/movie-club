import { DateTime } from "luxon";
import { ref, computed, watch } from "vue";

import { isDefined, isString } from "../../../../lib/checks/checks.js";
import { WorkListType, WorkType } from "../../../../lib/types/generated/db";
import { DetailedReviewListItem } from "../../../../lib/types/lists";
import {
  normalizeArray,
  createHistogramData,
  MovieStatistics,
  HistogramData,
} from "../StatisticsUtils";

import { filterMovies } from "@/common/searchMovies";
import { useMembers, useClub, useClubId } from "@/service/useClub";
import { useList } from "@/service/useList";

export function useStatisticsData() {
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
  const histogramData = ref<HistogramData[]>([]);
  const histogramNormData = ref<HistogramData[]>([]);

  const searchTerm = ref("");

  const loading = computed(
    () =>
      loadingReviews.value ||
      loadingMembers.value ||
      loadingClub.value ||
      loadingCalculations.value,
  );

  const filteredMovieData = computed(() => {
    return filterMovies(movieData.value, searchTerm.value);
  });

  const hasReviews = computed(() => (movieData.value?.length ?? 0) > 0);
  const hasSearchTerm = computed(() => searchTerm.value.trim().length > 0);
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
      .filter(isDefined);
  };

  const calculateStatistics = () => {
    if (movieData.value.length === 0) {
      loadingCalculations.value = false;
      return;
    }

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

    loadingCalculations.value = false;
  };

  const setReviews = (isLoading: boolean) => {
    if (isLoading) return;
    movieData.value = fetchMovieData(reviews.value ?? []);
    calculateStatistics();
  };

  watch(loadingReviews, setReviews);
  setReviews(loadingReviews.value);

  const toggleNormalize = () => {
    normalize.value = !normalize.value;
  };

  return {
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
  };
}
