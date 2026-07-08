import { DateTime } from "luxon";
import { computed } from "vue";

import { isDefined } from "../../../../lib/checks/checks.js";
import { WorkType } from "../../../../lib/types/generated/db";
import { DetailedReviewListItem } from "../../../../lib/types/lists";
import { createHistogramData } from "../scoring";
import type { WorkStatsBase, WorkStatsData, HistogramData } from "../types";

import { asBook, isMovieData } from "@/common/workDisplay";
import { useMembers, useClubSlug } from "@/service/useClub";
import { useReviewsList } from "@/service/useList";

export function useStatisticsData() {
  const clubSlug = useClubSlug();
  const { isLoading: loadingReviews, data: reviews } = useReviewsList(clubSlug);
  const { isLoading: loadingMembers, data: rawMembers } = useMembers(clubSlug);
  const members = computed(() => rawMembers.value ?? []);

  const loading = computed(() => loadingReviews.value || loadingMembers.value);

  const processedData = computed<{
    workData: WorkStatsData[];
    histogramData: HistogramData[];
  }>(() => {
    const rawReviews = reviews.value;
    if (!rawReviews || rawReviews.length === 0) {
      return { workData: [], histogramData: [] };
    }

    const works = mapReviewsToWorks(rawReviews);
    if (works.length === 0) {
      return { workData: [], histogramData: [] };
    }

    return enrichWithStatistics(works, members.value);
  });

  const workData = computed(() => processedData.value.workData);
  const histogramData = computed(() => processedData.value.histogramData);

  const hasReviews = computed(() => workData.value.length > 0);

  return {
    loading,
    workData,
    members,
    histogramData,
    hasReviews,
  };
}

/**
 * Builds the club-type-specific WorkStatsData for one review, or `null` to drop
 * it. Keyed by WorkType so a new club type only adds an entry here rather than
 * growing another `if (review.type === ...)` branch — the same registry pattern
 * as CLUB_TYPE_CONFIG, kept feature-local because it depends on statistics types.
 */
const WORK_STATS_BUILDERS: Record<
  WorkType,
  (base: WorkStatsBase, review: DetailedReviewListItem) => WorkStatsData | null
> = {
  [WorkType.book]: (base, review) => ({
    // Book stats are score-only, so a book still counts without metadata.
    ...base,
    type: WorkType.book,
    externalData: asBook(review.externalData),
  }),
  [WorkType.movie]: (base, review) => {
    // Movie stats read external metadata; skip works without it.
    const externalData = review.externalData;
    if (!isMovieData(externalData)) return null;
    return {
      ...base,
      type: WorkType.movie,
      genres: externalData.genres,
      production_companies: externalData.production_companies,
      production_countries: externalData.production_countries,
      externalData,
    };
  },
};

function statsBase(review: DetailedReviewListItem): WorkStatsBase {
  return {
    id: review.id,
    title: review.title,
    dateWatched: DateTime.fromISO(review.createdDate).toLocaleString(),
    userScores: Object.keys(review.scores).reduce<
      Record<string, number | undefined>
    >((acc, key) => {
      if (key !== "average" && isDefined(review.scores[key].score)) {
        acc[key] = review.scores[key].score;
      }
      return acc;
    }, {}),
    scores: review.scores,
    average: review.scores.average?.score ?? 0,
    imageUrl: review.imageUrl,
    createdDate: review.createdDate,
  };
}

function mapReviewsToWorks(reviews: DetailedReviewListItem[]): WorkStatsData[] {
  return reviews
    .map((review) =>
      WORK_STATS_BUILDERS[review.type](statsBase(review), review),
    )
    .filter(isDefined)
    .filter((work) => Object.keys(work.userScores).length > 0);
}

function enrichWithStatistics(
  works: WorkStatsData[],
  memberList: { id: string }[],
): {
  workData: WorkStatsData[];
  histogramData: HistogramData[];
} {
  const histogram: HistogramData[] = createHistogramData(
    works.map((data) => data.average),
  );

  for (const member of memberList) {
    for (let i = 0; i <= 10; i++) {
      histogram[i][member.id] = 0;
    }
  }

  for (const work of works) {
    for (const member of memberList) {
      const rawScore = work.userScores[member.id];
      if (isDefined(rawScore)) {
        const score = Math.floor(rawScore);
        if (!isNaN(score)) {
          histogram[score][member.id] += 1;
        }
      }
    }
  }

  return {
    workData: works,
    histogramData: histogram,
  };
}
