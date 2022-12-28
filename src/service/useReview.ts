import {
  CacheDataService,
  DetailedReviewResponse,
  ReviewResponse,
} from "@/common/types/models";
import { computed, watch } from "vue";
import { useStore } from "vuex";
import { useAuthRequest, useRequestCache } from "./useRequest";

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
  const store = useStore();
  watch(fetch.data, (newValue) => {
    if (newValue) {
      store.commit("reviews/addClub", { clubId, reviews: newValue });
    }
  });
  const data = computed(() => store.getters["reviews/getClubReviews"](clubId));
  return { ...fetch, data };
}

export function useSubmitScore(clubId: string) {
  const request = useAuthRequest<ReviewResponse>();
  const store = useStore();
  const submit = async (user: string, movieId: number, score: number) => {
    await request.execute(`/api/club/${clubId}/reviews/${movieId}`, {
      data: {
        name: user,
        score: score,
      },
      method: "PUT",
    });
    if (request.data.value) {
      const response = request.data.value;
      store.commit("reviews/updateScore", {
        clubId,
        movieId: response.movieId,
        scores: response.scores,
      });
    }
  };
  return { ...request, submit };
}

export function useAddReview(clubId: string) {
  const request = useAuthRequest<ReviewResponse>();
  const store = useStore();
  const addReview = async (movieId: number) => {
    await request.execute(`/api/club/${clubId}/reviews/${movieId}`, {
      method: "POST",
    });
    if (request.response.value) {
      store.commit("reviews/addReview", {
        clubId,
        review: request.data.value,
      });
    }
  };
  return { ...request, addReview };
}
