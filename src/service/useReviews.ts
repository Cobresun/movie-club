import { useMutation, useQueryClient } from "@tanstack/vue-query";

import { useUser } from "./useUser";
import { isDefined } from "../../lib/checks/checks.js";
import { WorkListType } from "../../lib/types/generated/db";
import { DetailedReviewListItem } from "../../lib/types/lists";

import { useAuthStore } from "@/stores/auth";

export function useReviewWork(clubIdentifier: string) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  const user = useUser();

  return useMutation({
    mutationFn: ({ workId, score }: { workId: string; score: number }) =>
      auth.request.post(`/api/club/${clubIdentifier}/reviews`, {
        score,
        workId,
      }),
    onMutate: ({ workId, score }) => {
      if (!workId) return;
      queryClient.setQueryData<DetailedReviewListItem[]>(
        ["list", clubIdentifier, WorkListType.reviews],
        (currentReviews) => {
          const userId = user.value?.id;
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
        queryKey: ["list", clubIdentifier, WorkListType.reviews],
      }),
  });
}

export function useUpdateReviewScore(clubIdentifier: string) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  const user = useUser();
  return useMutation({
    mutationFn: ({ reviewId, score }: { reviewId: string; score: number }) =>
      auth.request.put(`/api/club/${clubIdentifier}/reviews/${reviewId}`, {
        score,
      }),
    onMutate: ({ reviewId, score }) => {
      if (!reviewId) return;
      const currentUser = user.value;
      queryClient.setQueryData<DetailedReviewListItem[]>(
        ["list", clubIdentifier, WorkListType.reviews],
        (currentReviews) => {
          if (!currentReviews || !currentUser) return currentReviews;
          return currentReviews.map((review) =>
            Object.keys(review.scores).some(
              (key) => review.scores[key].id === reviewId,
            )
              ? {
                  ...review,
                  scores: {
                    ...review.scores,
                    [currentUser.id]: {
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
        queryKey: ["list", clubIdentifier, WorkListType.reviews],
      }),
  });
}
