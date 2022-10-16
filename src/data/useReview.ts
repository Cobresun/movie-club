import {
  CacheDataService,
  DetailedReviewResponse,
  ReviewResponse,
} from "@/models";
import { computed, watch } from "vue";
import { useStore } from "vuex";
import { useAuthRequest, useRequestCache } from "./useRequest";

export function useReview(clubId: string): CacheDataService<ReviewResponse[]> {
  const store = useStore();
  const fetch = useRequestCache<DetailedReviewResponse[]>(
    `review-${clubId}`,
    `/api/club/${clubId}/reviews`
  );
  watch(fetch.data, (newValue) => {
    if (newValue) {
      store.commit("reviews/addClub", { clubId, reviews: newValue });
    }
  });
  const data = computed(() => store.getters["reviews/getClubReviews"](clubId));
  return { ...fetch, data };
}

export function useDetailedReview(
  clubId: string
): CacheDataService<DetailedReviewResponse[]> {
  const fetch = useRequestCache<DetailedReviewResponse[]>(
    `review-d-${clubId}`,
    `/api/club/${clubId}/reviews?detailed=true`
  );
  return { ...fetch };
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
      store.commit("reviews/updateScore", {
        clubId,
        review: request.data.value,
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
    if (request.data.value) {
      store.commit("reviews/addReview", {
        clubId,
        review: request.data.value,
      });
    }
  };
  return { ...request, addReview };
}
