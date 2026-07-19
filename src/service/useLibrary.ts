import {
  UseQueryReturnType,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/vue-query";
import { AxiosError } from "axios";

import { hasValue } from "../../lib/checks/checks";
import { WorkType } from "../../lib/types/generated/db";
import { DetailedWorkData } from "../../lib/types/lists";
import {
  DiaryWatch,
  EditWatchRequest,
  ForWorkWatch,
  LogWatchRequest,
  LogWatchResponse,
} from "../../lib/types/me.js";

import { useAuthStore } from "@/stores/auth";

// ---------------------------------------------------------------------------
// Query keys — namespaced under ["me", ...] so they never collide with the
// club-scoped families (["club", ...], ["list", ...]). Invalidating the
// myWatchesKey prefix also matches every for-work key beneath it.
// ---------------------------------------------------------------------------

export const myWatchesKey = ["me", "watches"] as const;

export const myWatchesForWorkKey = (type: WorkType, externalId: string) =>
  ["me", "watches", "for-work", type, externalId] as const;

export const myWorkDetailsKey = (type: WorkType, externalId: string) =>
  ["me", "work-details", type, externalId] as const;

// ---------------------------------------------------------------------------
// Diary stream
// ---------------------------------------------------------------------------

/**
 * The user's full diary: every watch, with its attached club review events
 * nested. The watch owns the canonical score; club events carry none.
 */
export function useMyWatches(): UseQueryReturnType<DiaryWatch[], AxiosError> {
  const auth = useAuthStore();
  return useQuery({
    queryKey: myWatchesKey,
    queryFn: async () =>
      (await auth.request.get<DiaryWatch[]>("/api/me/watches")).data,
  });
}

/**
 * Cached external metadata (TMDB / Google Books) for one work, so the library
 * timeline drawer can render the same rich sections as the club reviews drawer.
 * Only enabled for works with an external id — manual logs (no externalId) have
 * no provider metadata, so the drawer falls back to the timeline alone.
 * Resolves to `null` when the provider has nothing cached for the id.
 */
export function useMyWorkDetails(
  type: WorkType,
  externalId: string | null,
): UseQueryReturnType<DetailedWorkData | null, AxiosError> {
  const auth = useAuthStore();
  return useQuery({
    queryKey: myWorkDetailsKey(type, externalId ?? ""),
    enabled: hasValue(externalId),
    queryFn: async () =>
      (
        await auth.request.get<DetailedWorkData | null>(
          "/api/me/watches/work-details",
          { params: { type, externalId } },
        )
      ).data,
  });
}

/**
 * Prior watches of one work across contexts (foundation for M2's
 * previous-scores prompt).
 */
export function useMyWatchesForWork(
  type: WorkType,
  externalId: string,
): UseQueryReturnType<ForWorkWatch[], AxiosError> {
  const auth = useAuthStore();
  return useQuery({
    queryKey: myWatchesForWorkKey(type, externalId),
    queryFn: async () =>
      (
        await auth.request.get<ForWorkWatch[]>("/api/me/watches/for-work", {
          params: { type, externalId },
        })
      ).data,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Log a watch. Invalidates only the me-scoped keys — a solo log alters no club
 * row. Invalidating the myWatchesKey prefix also refreshes any for-work query
 * for the logged work.
 */
export function useLogWatch() {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: LogWatchRequest) =>
      (await auth.request.post<LogWatchResponse>("/api/me/watches", body)).data,
    onSettled: () => queryClient.invalidateQueries({ queryKey: myWatchesKey }),
  });
}

/**
 * Patch-merge a watch edit into the cached diary. Undefined patch fields mean
 * "leave unchanged"; `null` is a real cleared value (e.g. removing a score or
 * watched date), so fields compare against `undefined` explicitly rather than
 * through isDefined (which also rejects null).
 */
function applyPatch(watch: DiaryWatch, patch: EditWatchRequest): DiaryWatch {
  return {
    ...watch,
    score: patch.score !== undefined ? patch.score : watch.score,
    watchedDate:
      patch.watchedDate !== undefined ? patch.watchedDate : watch.watchedDate,
    rewatch: patch.rewatch !== undefined ? patch.rewatch : watch.rewatch,
    text: patch.text !== undefined ? patch.text : watch.text,
  };
}

/**
 * Edit a watch (patch semantics). Optimistic, with rollback. A score edit here
 * is the canonical score every attached club review reads, so club-scoped
 * caches are invalidated wholesale too.
 */
export function useEditWatch() {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      watchId,
      patch,
    }: {
      watchId: string;
      patch: EditWatchRequest;
    }) => auth.request.put(`/api/me/watches/${watchId}`, patch),
    onMutate: async ({ watchId, patch }) => {
      await queryClient.cancelQueries({ queryKey: myWatchesKey });
      const previous = queryClient.getQueryData<DiaryWatch[]>(myWatchesKey);
      queryClient.setQueryData<DiaryWatch[]>(myWatchesKey, (current) =>
        current?.map((watch) =>
          watch.watchId === watchId ? applyPatch(watch, patch) : watch,
        ),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(myWatchesKey, context.previous);
      }
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: myWatchesKey }),
        // The edited score surfaces in every club that reviewed this watch.
        queryClient.invalidateQueries({ queryKey: ["list"] }),
      ]),
  });
}

/**
 * Delete a watch. Optimistic removal, with rollback. The backend rejects
 * deleting a watch with club reviews attached — the UI hides the affordance,
 * and a rejected race rolls back here.
 */
export function useDeleteWatch() {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (watchId: string) =>
      auth.request.delete(`/api/me/watches/${watchId}`),
    onMutate: async (watchId) => {
      await queryClient.cancelQueries({ queryKey: myWatchesKey });
      const previous = queryClient.getQueryData<DiaryWatch[]>(myWatchesKey);
      queryClient.setQueryData<DiaryWatch[]>(myWatchesKey, (current) =>
        current?.filter((watch) => watch.watchId !== watchId),
      );
      return { previous };
    },
    onError: (_err, _watchId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(myWatchesKey, context.previous);
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: myWatchesKey }),
  });
}
