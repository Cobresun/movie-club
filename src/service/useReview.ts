import {
  useMutation,
  useQuery,
  useQueryClient,
  UseQueryReturnType,
} from "@tanstack/vue-query";
import axios, { AxiosError } from "axios";

import { useUser } from "./useUser";

import { DetailedReviewResponse } from "@/common/types/models";
import { useAuthStore } from "@/stores/auth";

export function useDetailedReview(
  clubId: string
): UseQueryReturnType<DetailedReviewResponse[], AxiosError> {
  return useQuery(
    ["review-d", clubId],
    async () =>
      (
        await axios.get<DetailedReviewResponse[]>(
          `/api/club/${clubId}/reviews?detailed=true`
        )
      ).data
  );
}

export function useSubmitScore(clubId: string) {
  const { data: user } = useUser();
  const { authToken } = useAuthStore();
  const queryClient = useQueryClient();
  return useMutation(
    ({ movieId, score }: { movieId: number; score: number }) =>
      axios.put(
        `/api/club/${clubId}/reviews/${movieId}`,
        {
          name: user.value?.name,
          score: score,
        },
        { headers: { Authorization: `Bearer ${authToken}` } }
      ),
    {
      onMutate: async ({ movieId, score }) => {
        await queryClient.cancelQueries(["review-d", clubId]);
        queryClient.setQueryData<DetailedReviewResponse[]>(
          ["review-d", clubId],
          (currentReviews) => {
            const name = user.value?.name;
            if (!currentReviews || !name) return currentReviews;
            return currentReviews.map((review) =>
              review.movieId === movieId
                ? {
                    ...review,
                    scores: { ...review.scores, [name]: score },
                  }
                : { ...review }
            );
          }
        );
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: ["review-d", clubId] });
      },
    }
  );
}

export function useAddReview(clubId: string) {
  const { authToken } = useAuthStore();
  const queryClient = useQueryClient();
  return useMutation(
    ({ movieId }: { movieId: number }) =>
      axios.post(`/api/club/${clubId}/reviews/${movieId}`, undefined, {
        headers: { Authorization: `Bearer ${authToken}` },
      }),
    {
      onSuccess: (response) => {
        queryClient.setQueryData<DetailedReviewResponse[]>(
          ["review-d", clubId],
          (currentReviews) => {
            if (!currentReviews) return [response.data];
            return [response.data, ...currentReviews];
          }
        );
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: ["review-d", clubId] });
      },
    }
  );
}
