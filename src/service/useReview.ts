import { computed, watch } from "vue";

import { useAuthRequest, useRequestCache } from "./useRequest";
import { useUser } from "./useUser";

import {
  CacheDataService,
  DetailedReviewResponse,
  ReviewResponse,
} from "@/common/types/models";
import { useReviewsStore } from "@/stores/reviews";

export function useReview(clubId: string): CacheDataService<ReviewResponse[]> {
  const fetch = useRequestCache<DetailedReviewResponse[]>(
    `review-${clubId}`,
    `/api/club/${clubId}/reviews`
  );
  return { ...fetch };
}

export function useDetailedReview(
  clubId: string
): CacheDataService<DetailedReviewResponse[]> {
  const fetch = useRequestCache<DetailedReviewResponse[]>(
    `review-d-${clubId}`,
    `/api/club/${clubId}/reviews?detailed=true`
  );
  const store = useReviewsStore();
  watch(fetch.data, (newValue) => {
    if (newValue) {
      store.addClub(clubId, newValue);
    }
  });
  const data = computed(() => store.getClubReviews(clubId));
  return { ...fetch, data };
}

export function useSubmitScore(clubId: string) {
  const request = useAuthRequest<ReviewResponse>();
  const store = useReviewsStore();
  const { data: user } = useUser();
  const submit = async (movieId: number, score: number) => {
    await request.execute(`/api/club/${clubId}/reviews/${movieId}`, {
      data: {
        name: user.value?.name,
        score: score,
      },
      method: "PUT",
    });
    if (request.data.value) {
      const response = request.data.value;
      store.updateScore(clubId, response.movieId, response.scores);
    }
  };
  return { ...request, submit };
}

export function useAddReview(clubId: string) {
  const request = useAuthRequest<DetailedReviewResponse>();
  const store = useReviewsStore();
  const addReview = async (movieId: number) => {
    await request.execute(`/api/club/${clubId}/reviews/${movieId}`, {
      method: "POST",
    });
    if (request.data.value) {
      store.addReview(clubId, request.data.value);
    }
  };
  return { ...request, addReview };
}
