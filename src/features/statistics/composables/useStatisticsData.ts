import { DateTime } from "luxon";
import { ref, computed } from "vue";

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

  const normalize = ref(false);
  const searchTerm = ref("");

  const loading = computed(
    () => loadingReviews.value || loadingMembers.value || loadingClub.value,
  );

  const processedData = computed<{
    movieData: MovieStatistics[];
    histogramData: HistogramData[];
    histogramNormData: HistogramData[];
  }>(() => {
    const rawReviews = reviews.value;
    if (!rawReviews || rawReviews.length === 0) {
      return { movieData: [], histogramData: [], histogramNormData: [] };
    }

    const movies = mapReviewsToMovies(rawReviews);
    if (movies.length === 0) {
      return { movieData: [], histogramData: [], histogramNormData: [] };
    }

    return enrichWithStatistics(movies, members.value);
  });

  const movieData = computed(() => processedData.value.movieData);
  const histogramData = computed(() => processedData.value.histogramData);
  const histogramNormData = computed(
    () => processedData.value.histogramNormData,
  );

  const filteredMovieData = computed(() => {
    return filterMovies(movieData.value, searchTerm.value);
  });

  const totalMovies = computed(() => movieData.value?.length ?? 0);

  const totalRuntimeMinutes = computed(() =>
    (movieData.value ?? []).reduce(
      (sum, movie) => sum + (movie.externalData?.runtime ?? 0),
      0,
    ),
  );

  const hasReviews = computed(() => totalMovies.value > 0);
  const hasSearchTerm = computed(() => searchTerm.value.trim().length > 0);
  const showEmptyState = computed(
    () => !loading.value && filteredMovieData.value.length === 0,
  );

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
    totalMovies,
    totalRuntimeMinutes,
    hasReviews,
    hasSearchTerm,
    showEmptyState,
    toggleNormalize,
  };
}

function mapReviewsToMovies(
  reviews: DetailedReviewListItem[],
): MovieStatistics[] {
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
        normalized: {} as Record<string, number>,
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
}

function enrichWithStatistics(
  movies: MovieStatistics[],
  memberList: { id: string }[],
): {
  movieData: MovieStatistics[];
  histogramData: HistogramData[];
  histogramNormData: HistogramData[];
} {
  const histogram: HistogramData[] = createHistogramData(
    movies.map((data) => data.average),
    false,
  );
  const histogramNorm: HistogramData[] = createHistogramData(
    movies.map((data) => data.average),
    true,
  );

  const memberScores: Record<string, number[]> = {};
  const tmdbNorm = normalizeArray(
    movies.map((data) =>
      isString(data.vote_average)
        ? parseFloat(data.vote_average as unknown as string)
        : data.vote_average,
    ),
  );

  for (const member of memberList) {
    memberScores[member.id] = normalizeArray(
      movies.map((data) => data.userScores[member.id]),
    );
    for (let i = 0; i <= 10; i++) {
      histogram[i][member.id] = 0;
      histogramNorm[i][member.id] = 0;
    }
  }

  const enrichedMovies = movies.map((movie, i) => {
    const normalized: Record<string, number> = {};
    let avg = 0;

    for (const member of memberList) {
      normalized[member.id] = memberScores[member.id][i];
      avg += memberScores[member.id][i];

      const score = Math.floor(movie.userScores[member.id]);
      if (!isNaN(score)) {
        histogram[score][member.id] += 1;
      }
      let scoreNorm = Math.floor(normalized[member.id] * 4 + 5);
      scoreNorm = scoreNorm < 0 ? 0 : scoreNorm > 10 ? 10 : scoreNorm;
      histogramNorm[scoreNorm][member.id] += 1;
    }

    avg = avg / memberList.length;
    normalized["average"] = Math.round(avg * 100) / 100;
    normalized["vote_average"] = tmdbNorm[i];

    const curVoteAvg = movie.vote_average;
    const releaseDate = movie.release_date;

    return {
      ...movie,
      normalized,
      vote_average: isString(curVoteAvg)
        ? parseFloat(curVoteAvg as unknown as string)
        : curVoteAvg,
      release_year: isDefined(releaseDate)
        ? parseInt(releaseDate.substring(0, 4))
        : undefined,
      revenueMil: (movie.revenue ?? 0) / 1000000,
      budgetMil: (movie.budget ?? 0) / 1000000,
    };
  });

  return {
    movieData: enrichedMovies,
    histogramData: histogram,
    histogramNormData: histogramNorm,
  };
}
