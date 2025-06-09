import { useMutation, useQueryClient } from "@tanstack/vue-query";

import { useUser } from "./useUser";
import { isDefined } from "../../lib/checks/checks.js";
import { WorkListType } from "../../lib/types/generated/db";
import { DetailedReviewListItem } from "../../lib/types/lists";

import { useAuthStore } from "@/stores/auth";

export function useReviewWork(clubId: string) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  const { data: user } = useUser();

  return useMutation({
    mutationFn: ({
      workId,
      score,
      emoji,
    }: {
      workId: string;
      score: number;
      emoji?: string;
    }) =>
      auth.request.post(`/api/club/${clubId}/reviews`, {
        score,
        workId,
        emoji,
      }),
    onMutate: ({ workId, score, emoji }) => {
      if (!workId) return;
      queryClient.setQueryData<DetailedReviewListItem[]>(
        ["list", clubId, WorkListType.reviews],
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
                      emoji,
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

export function useUpdateReviewEmoji(clubId: string) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      reviewId,
      emoji,
    }: {
      reviewId: string;
      emoji: string | null;
    }) =>
      auth.request.put(`/api/club/${clubId}/reviews/${reviewId}/emoji`, {
        emoji,
      }),
    onMutate: async ({ reviewId, emoji }) => {
      if (!reviewId) return;

      await queryClient.cancelQueries({
        queryKey: ["list", clubId, WorkListType.reviews],
      });

      const previousReviews = queryClient.getQueryData<
        DetailedReviewListItem[]
      >(["list", clubId, WorkListType.reviews]);

      queryClient.setQueryData<DetailedReviewListItem[]>(
        ["list", clubId, WorkListType.reviews],
        (currentReviews) => {
          if (!currentReviews) return currentReviews;
          return currentReviews.map((review) => {
            const userId = Object.keys(review.scores).find(
              (key) => review.scores[key].id === reviewId,
            );

            if (userId) {
              return {
                ...review,
                scores: {
                  ...review.scores,
                  [userId]: {
                    ...review.scores[userId],
                    emoji,
                  },
                },
              };
            }
            return review;
          });
        },
      );
      return { previousReviews };
    },
    onError: (err, newTodo, context) => {
      if (context?.previousReviews) {
        queryClient.setQueryData(
          ["list", clubId, WorkListType.reviews],
          context.previousReviews,
        );
      }
    },
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: ["list", clubId, WorkListType.reviews],
      }),
  });
}
