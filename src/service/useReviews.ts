import { useMutation, useQueryClient } from "@tanstack/vue-query";

import { isDefined } from "../../lib/checks/checks.js";
import { WorkListType } from "../../lib/types/generated/db";
import { DetailedReviewListItem } from "../../lib/types/lists";

import { useAuthStore } from "@/stores/auth";

export function useReviewWork(clubId: string) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();

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
          const userId = auth.user?.id;
          if (!currentReviews || !isDefined(userId)) return currentReviews;
          return currentReviews.map((review) =>
            review.id === workId
              ? {
                  ...review,
                  scores: {
                    ...review.scores,
                    [userId]: {
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
  return useMutation({
    mutationFn: ({ reviewId, score }: { reviewId: string; score: number }) =>
      auth.request.put(`/api/club/${clubId}/reviews/${reviewId}`, { score }),
    onMutate: ({ reviewId, score }) => {
      if (!reviewId) return;
      queryClient.setQueryData<DetailedReviewListItem[]>(
        ["list", clubId, WorkListType.reviews],
        (currentReviews) => {
          const user = auth.user;
          if (!currentReviews || !user) return currentReviews;
          return currentReviews.map((review) =>
            Object.keys(review.scores).some(
              (key) => review.scores[key].id === reviewId,
            )
              ? {
                  ...review,
                  scores: {
                    ...review.scores,
                    [user.id]: {
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
