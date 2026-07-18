import {
  UseQueryReturnType,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/vue-query";
import { AxiosError } from "axios";

import { WorkType } from "../../lib/types/generated/db";
import {
  DiaryEntry,
  EditSoloReviewRequest,
  ForWorkEvent,
  LogWatchRequest,
  LogWatchResponse,
} from "../../lib/types/me.js";

import { useAuthStore } from "@/stores/auth";

// ---------------------------------------------------------------------------
// Query keys — namespaced under ["me", ...] so they never collide with the
// club-scoped families (["club", ...], ["list", ...]). Invalidating the
// myReviewsKey prefix also matches every for-work key beneath it.
// ---------------------------------------------------------------------------

export const myReviewsKey = ["me", "reviews"] as const;

export const myReviewsForWorkKey = (type: WorkType, externalId: string) =>
  ["me", "reviews", "for-work", type, externalId] as const;

// ---------------------------------------------------------------------------
// Diary stream
// ---------------------------------------------------------------------------

/** The user's full diary: every review event across solo + all their clubs. */
export function useMyReviews(): UseQueryReturnType<DiaryEntry[], AxiosError> {
  const auth = useAuthStore();
  return useQuery({
    queryKey: myReviewsKey,
    queryFn: async () =>
      (await auth.request.get<DiaryEntry[]>("/api/me/reviews")).data,
  });
}

/**
 * Prior events for one work across contexts (foundation for M2's
 * previous-scores prompt).
 */
export function useMyReviewsForWork(
  type: WorkType,
  externalId: string,
): UseQueryReturnType<ForWorkEvent[], AxiosError> {
  const auth = useAuthStore();
  return useQuery({
    queryKey: myReviewsForWorkKey(type, externalId),
    queryFn: async () =>
      (
        await auth.request.get<ForWorkEvent[]>("/api/me/reviews/for-work", {
          params: { type, externalId },
        })
      ).data,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Log a watch (create a solo review event). Invalidates only the me-scoped
 * keys — a solo log alters no club row, and cross-context poster score is a
 * later milestone concern. Invalidating the myReviewsKey prefix also refreshes
 * any for-work query for the logged work.
 */
export function useLogWatch() {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: LogWatchRequest) =>
      (await auth.request.post<LogWatchResponse>("/api/me/reviews", body)).data,
    onSettled: () => queryClient.invalidateQueries({ queryKey: myReviewsKey }),
  });
}

/**
 * Patch-merge a solo event into the cached diary. Undefined patch fields mean
 * "leave unchanged"; `null` is a real cleared value (e.g. removing a score or
 * watched date), so fields compare against `undefined` explicitly rather than
 * through isDefined (which also rejects null).
 */
function applyPatch(
  entry: DiaryEntry,
  patch: EditSoloReviewRequest,
): DiaryEntry {
  return {
    ...entry,
    score: patch.score !== undefined ? patch.score : entry.score,
    watchedDate:
      patch.watchedDate !== undefined ? patch.watchedDate : entry.watchedDate,
    rewatch: patch.rewatch !== undefined ? patch.rewatch : entry.rewatch,
    text: patch.text !== undefined ? patch.text : entry.text,
  };
}

/** Edit a solo review event (patch semantics). Optimistic, with rollback. */
export function useEditSoloReview() {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      reviewId,
      patch,
    }: {
      reviewId: string;
      patch: EditSoloReviewRequest;
    }) => auth.request.put(`/api/me/reviews/${reviewId}`, patch),
    onMutate: async ({ reviewId, patch }) => {
      await queryClient.cancelQueries({ queryKey: myReviewsKey });
      const previous = queryClient.getQueryData<DiaryEntry[]>(myReviewsKey);
      queryClient.setQueryData<DiaryEntry[]>(myReviewsKey, (current) =>
        current?.map((entry) =>
          entry.reviewId === reviewId ? applyPatch(entry, patch) : entry,
        ),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(myReviewsKey, context.previous);
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: myReviewsKey }),
  });
}

/** Delete a solo review event. Optimistic removal, with rollback. */
export function useDeleteSoloReview() {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reviewId: string) =>
      auth.request.delete(`/api/me/reviews/${reviewId}`),
    onMutate: async (reviewId) => {
      await queryClient.cancelQueries({ queryKey: myReviewsKey });
      const previous = queryClient.getQueryData<DiaryEntry[]>(myReviewsKey);
      queryClient.setQueryData<DiaryEntry[]>(myReviewsKey, (current) =>
        current?.filter((entry) => entry.reviewId !== reviewId),
      );
      return { previous };
    },
    onError: (_err, _reviewId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(myReviewsKey, context.previous);
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: myReviewsKey }),
  });
}
