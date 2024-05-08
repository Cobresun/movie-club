import {
  useMutation,
  useQuery,
  useQueryClient,
  UseQueryReturnType,
} from "@tanstack/vue-query";
import axios, { AxiosError } from "axios";

import { useUser } from "./useUser";

import { DetailedReviewListItem } from "@/common/types/lists";
import { Review } from "@/common/types/reviews";
import { useAuthStore } from "@/stores/auth";

export function useReviews(
  clubId: string
): UseQueryReturnType<DetailedReviewListItem[], AxiosError> {
  return useQuery({
    queryKey: ["review-d", clubId],
    queryFn: async () => (await axios.get(`/api/club/${clubId}/reviews`)).data,
  });
}

export function useSubmitScore(clubId: string) {
  const { data: user } = useUser();
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ movieId, score }: { movieId: number; score: number }) =>
      auth.request.put(`/api/club/${clubId}/reviews/${movieId}`, {
        name: user.value?.name,
        score: score,
      }),
    onMutate: async ({ movieId, score }) => {
      await queryClient.cancelQueries(["review-d", clubId]);
      queryClient.setQueryData<Review[]>(
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
  });
}

export function useAddReview(clubId: string) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (movieId: number) =>
      auth.request.post(`/api/club/${clubId}/reviews/${movieId}`),
    onSuccess: (response) => {
      queryClient.setQueryData<Review[]>(
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
  });
}
