import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";

import { useUser } from "./useUser";
import { isDefined } from "../../lib/checks/checks.js";
import { WorkListType } from "../../lib/types/generated/db";
import {
  DetailedReviewListItem,
  ReviewCommentDto,
} from "../../lib/types/lists";

import { useAuthStore } from "@/stores/auth";

export function useReviewWork(clubSlug: string) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  const user = useUser();

  return useMutation({
    mutationFn: ({ workId, score }: { workId: string; score: number }) =>
      auth.request.post(`/api/club/${clubSlug}/reviews`, {
        score,
        workId,
      }),
    onMutate: ({ workId, score }) => {
      if (!workId) return;
      queryClient.setQueryData<DetailedReviewListItem[]>(
        ["list", clubSlug, WorkListType.reviews],
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
        queryKey: ["list", clubSlug, WorkListType.reviews],
      }),
  });
}

export function useUpdateReviewScore(clubSlug: string) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  const user = useUser();
  return useMutation({
    mutationFn: ({ reviewId, score }: { reviewId: string; score: number }) =>
      auth.request.put(`/api/club/${clubSlug}/reviews/${reviewId}`, {
        score,
      }),
    onMutate: ({ reviewId, score }) => {
      if (!reviewId) return;
      const currentUser = user.value;
      queryClient.setQueryData<DetailedReviewListItem[]>(
        ["list", clubSlug, WorkListType.reviews],
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
        queryKey: ["list", clubSlug, WorkListType.reviews],
      }),
  });
}

export function useReviewComments(clubSlug: string, workId: string) {
  const auth = useAuthStore();
  return useQuery<ReviewCommentDto[]>({
    queryKey: ["comments", clubSlug, workId],
    queryFn: async () => {
      const response = await auth.request.get<ReviewCommentDto[]>(
        `/api/club/${clubSlug}/reviews/${workId}/comments`,
      );
      return response.data;
    },
  });
}

export function useAddReviewComment(clubSlug: string, workId: string) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  const user = useUser();

  return useMutation({
    mutationFn: (content: string) =>
      auth.request.post(`/api/club/${clubSlug}/reviews/${workId}/comments`, {
        content,
      }),
    onMutate: (content: string) => {
      const currentUser = user.value;
      if (!isDefined(currentUser)) return;
      queryClient.setQueryData<ReviewCommentDto[]>(
        ["comments", clubSlug, workId],
        (current) => [
          ...(current ?? []),
          {
            id: `temp-${Date.now()}`,
            workId,
            userId: currentUser.id,
            userName: currentUser.name,
            userImage: currentUser.image ?? undefined,
            content,
            createdDate: new Date().toISOString(),
          },
        ],
      );
    },
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: ["comments", clubSlug, workId],
      }),
  });
}

export function useDeleteReviewComment(clubSlug: string, workId: string) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (commentId: string) =>
      auth.request.delete(
        `/api/club/${clubSlug}/reviews/${workId}/comments/${commentId}`,
      ),
    onMutate: (commentId: string) => {
      queryClient.setQueryData<ReviewCommentDto[]>(
        ["comments", clubSlug, workId],
        (current) =>
          current?.filter((comment) => comment.id !== commentId) ?? [],
      );
    },
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: ["comments", clubSlug, workId],
      }),
  });
}
