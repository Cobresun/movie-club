import { DateTime } from "luxon";
import { computed } from "vue";

import { isDefined } from "../../../../lib/checks/checks.js";
import { WorkType } from "../../../../lib/types/generated/db";
import { DetailedReviewListItem } from "../../../../lib/types/lists";
import { normalizeArray, createHistogramData } from "../scoring";
import type { WorkStatsData, HistogramData } from "../types";

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

function mapReviewsToWorks(reviews: DetailedReviewListItem[]): WorkStatsData[] {
  return reviews
    .map((review): WorkStatsData | null => {
      const base = {
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
        normalized: {},
        imageUrl: review.imageUrl,
        createdDate: review.createdDate,
      };

      if (review.type === WorkType.book) {
        // Book stats are score-only, so a book still counts without metadata.
        return {
          ...base,
          type: WorkType.book,
          externalData: asBook(review.externalData),
        };
      }

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
    })
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

  const memberScores: Record<string, (number | undefined)[]> = {};

  for (const member of memberList) {
    memberScores[member.id] = normalizeArray(
      works.map((data) => data.userScores[member.id]),
    );
    for (let i = 0; i <= 10; i++) {
      histogram[i][member.id] = 0;
    }
  }

  const enrichedWorks = works.map((work, i) => {
    const normalized: Record<string, number | undefined> = {};

    for (const member of memberList) {
      const normVal = memberScores[member.id][i];
      if (isDefined(normVal)) {
        normalized[member.id] = normVal;
      }

      const rawScore = work.userScores[member.id];
      if (isDefined(rawScore)) {
        const score = Math.floor(rawScore);
        if (!isNaN(score)) {
          histogram[score][member.id] += 1;
        }
      }
    }

    return {
      ...work,
      normalized,
    };
  });

  return {
    workData: enrichedWorks,
    histogramData: histogram,
  };
}
