import {
  QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/vue-query";
import { AxiosInstance } from "axios";

import { myReviewsKey } from "./useLibrary";
import { reviewsListKey } from "./useList";
import { useUser } from "./useUser";
import { hasValue, isDefined } from "../../lib/checks/checks.js";
import { Member } from "../../lib/types/club";
import {
  DetailedReviewListItem,
  ReviewScores,
  WorkCommentDto,
} from "../../lib/types/lists";

import { useAuthStore } from "@/stores/auth";

const SCORE_POLL_ATTEMPTS = 10;
const SCORE_POLL_INTERVAL_MS = 500;

// After a member submits/edits their own score we briefly poll the lightweight
// per-work scores endpoint so everyone else's scores (submitted around the same
// time in a synchronized session) stream in without a manual refresh. Keyed by
// `${clubSlug}:${workId}` with a monotonic token so re-submitting the same work
// supersedes the previous loop instead of stacking a second one.
const activeScorePolls = new Map<string, number>();

function startScorePoll(
  request: AxiosInstance,
  queryClient: QueryClient,
  clubSlug: string,
  workId: string,
) {
  const pollKey = `${clubSlug}:${workId}`;
  const token = (activeScorePolls.get(pollKey) ?? 0) + 1;
  activeScorePolls.set(pollKey, token);

  const tick = async (attempt: number) => {
    if (activeScorePolls.get(pollKey) !== token) return;
    try {
      const { data } = await request.get<ReviewScores>(
        `/api/club/${clubSlug}/reviews/${workId}/scores`,
      );
      if (activeScorePolls.get(pollKey) !== token) return;
      queryClient.setQueryData<DetailedReviewListItem[]>(
        reviewsListKey(clubSlug),
        (current) =>
          current?.map((item) =>
            item.id === workId ? { ...item, scores: data } : item,
          ),
      );

      // Stop early once every current member has a score — there's nothing left
      // to wait for. (`data` also carries a synthetic `average` key, which we
      // ignore by checking each member id directly.)
      const members = queryClient.getQueryData<Member[]>(["members", clubSlug]);
      if (
        isDefined(members) &&
        members.length > 0 &&
        members.every((member) => isDefined(data[member.id]))
      ) {
        activeScorePolls.delete(pollKey);
        return;
      }
    } catch {
      // Transient failure — keep polling; a later tick may succeed.
    }
    if (attempt + 1 < SCORE_POLL_ATTEMPTS) {
      setTimeout(() => void tick(attempt + 1), SCORE_POLL_INTERVAL_MS);
    } else if (activeScorePolls.get(pollKey) === token) {
      activeScorePolls.delete(pollKey);
    }
  };

  setTimeout(() => void tick(0), SCORE_POLL_INTERVAL_MS);
}

export function useReviewWork(clubSlug: string) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  const user = useUser();

  return useMutation({
    mutationFn: ({
      workId,
      score,
      sourceListId,
    }: {
      workId: string;
      score: number;
      sourceListId?: string;
    }) =>
      auth.request.post(`/api/club/${clubSlug}/reviews`, {
        score,
        workId,
        sourceListId,
      }),
    onMutate: ({ workId, score }) => {
      if (!workId) return;
      queryClient.setQueryData<DetailedReviewListItem[]>(
        reviewsListKey(clubSlug),
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
    onSuccess: (_data, { workId }) =>
      startScorePoll(auth.request, queryClient, clubSlug, workId),
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: reviewsListKey(clubSlug),
      });
      // Club review rows surface read-through in the personal diary — the
      // same row, not a copy — so a club-side write must refresh it too.
      queryClient.invalidateQueries({ queryKey: myReviewsKey });
    },
  });
}

export function useUpdateReviewScore(clubSlug: string) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  const user = useUser();
  return useMutation({
    // `workId` isn't part of the PUT body — it's carried through so `onSuccess`
    // can poll the per-work scores endpoint after an edit.
    mutationFn: ({
      reviewId,
      score,
    }: {
      reviewId: string;
      workId: string;
      score: number;
    }) =>
      auth.request.put(`/api/club/${clubSlug}/reviews/${reviewId}`, {
        score,
      }),
    onMutate: ({ reviewId, score }) => {
      if (!reviewId) return;
      const currentUser = user.value;
      queryClient.setQueryData<DetailedReviewListItem[]>(
        reviewsListKey(clubSlug),
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
    onSuccess: (_data, { workId }) =>
      startScorePoll(auth.request, queryClient, clubSlug, workId),
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: reviewsListKey(clubSlug),
      });
      // Club review rows surface read-through in the personal diary — the
      // same row, not a copy — so a club-side write must refresh it too.
      queryClient.invalidateQueries({ queryKey: myReviewsKey });
    },
  });
}

/**
 * Create-or-update a score in one call: picks the right mutation based on
 * whether the user already has a review for the work. Collapses the identical
 * `reviewId ? update : create` branch that ReviewScore, ScoreEntryPanel, and
 * ScoreAssistModal all otherwise repeat. Callers are responsible for validating
 * the score (see `isValidScore` in scoreScale.ts) before calling.
 */
export function useSubmitScore(clubSlug: string) {
  const { mutate: create } = useReviewWork(clubSlug);
  const { mutate: update } = useUpdateReviewScore(clubSlug);

  return ({
    workId,
    reviewId,
    score,
  }: {
    workId: string;
    reviewId?: string;
    score: number;
  }) => {
    if (hasValue(reviewId)) {
      update({ reviewId, workId, score });
    } else {
      create({ workId, score });
    }
  };
}

export function useReviewComments(clubSlug: string, workId: string) {
  const auth = useAuthStore();
  return useQuery<WorkCommentDto[]>({
    queryKey: ["comments", clubSlug, workId],
    queryFn: async () => {
      const response = await auth.request.get<WorkCommentDto[]>(
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
    mutationFn: ({ content, spoiler }: { content: string; spoiler: boolean }) =>
      auth.request.post(`/api/club/${clubSlug}/reviews/${workId}/comments`, {
        content,
        spoiler,
      }),
    onMutate: ({ content, spoiler }) => {
      const currentUser = user.value;
      if (!isDefined(currentUser)) return;
      queryClient.setQueryData<WorkCommentDto[]>(
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
            spoiler,
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

export function useEditReviewComment(clubSlug: string, workId: string) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      commentId,
      content,
      spoiler,
    }: {
      commentId: string;
      content: string;
      spoiler?: boolean;
    }) =>
      auth.request.put(
        `/api/club/${clubSlug}/reviews/${workId}/comments/${commentId}`,
        { content, spoiler },
      ),
    onMutate: ({ commentId, content, spoiler }) => {
      queryClient.setQueryData<WorkCommentDto[]>(
        ["comments", clubSlug, workId],
        (current) =>
          current?.map((comment) =>
            comment.id === commentId
              ? {
                  ...comment,
                  content,
                  spoiler: spoiler ?? comment.spoiler,
                }
              : comment,
          ) ?? [],
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
      queryClient.setQueryData<WorkCommentDto[]>(
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
