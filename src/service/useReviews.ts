import { useMutation, useQueryClient } from "@tanstack/vue-query";

import { useUser } from "./useUser";

import { WorkListType } from "@/common/types/generated/db";
import { DetailedReviewListItem } from "@/common/types/lists";
import { useAuthStore } from "@/stores/auth";

export function useReviewWork(clubId: string) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  const { data: user } = useUser();

  return useMutation({
    mutationFn: ({ workId, score }: { workId: string; score: number }) =>
      auth.request.post(`/api/club/${clubId}/reviews`, {
        score,
        workId,
      }),
    onMutate: ({ workId, score }) => {
      if (!workId) return;
      queryClient.setQueryData<DetailedReviewListItem[]>(
        ["list", clubId, WorkListType.reviews],
        (currentReviews) => {
          if (!currentReviews || !user.value?.id) return currentReviews;
          return currentReviews.map((review) =>
            review.id === workId
              ? {
                  ...review,
                  scores: {
                    ...review.scores,
                    [user.value?.id]: {
                      id: "temp",
                      created_date: new Date().toISOString(),
                      score,
                    },
                  },
                }
              : review,
          );
        },
      );
    },
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: ["list", clubId, WorkListType.reviews],
      }),
  });
}

export function useUpdateReviewScore(clubId: string) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  const { data: user } = useUser();
  return useMutation({
    mutationFn: ({ reviewId, score }: { reviewId: string; score: number }) =>
      auth.request.put(`/api/club/${clubId}/reviews/${reviewId}`, { score }),
    onMutate: ({ reviewId, score }) => {
      if (!reviewId) return;
      queryClient.setQueryData<DetailedReviewListItem[]>(
        ["list", clubId, WorkListType.reviews],
        (currentReviews) => {
          if (!currentReviews || !user.value) return currentReviews;
          return currentReviews.map((review) =>
            Object.keys(review.scores).some(
              (key) => review.scores[key].id === reviewId,
            )
              ? {
                  ...review,
                  scores: {
                    ...review.scores,
                    [user.value.id]: {
                      id: reviewId,
                      created_date: new Date().toISOString(),
                      score,
                    },
                  },
                }
              : review,
          );
        },
      );
    },
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: ["list", clubId, WorkListType.reviews],
      }),
  });
}
