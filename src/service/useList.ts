import {
  UseQueryReturnType,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/vue-query";
import axios, { AxiosError } from "axios";
import { computed, unref, type MaybeRef } from "vue";

import { hasValue, isDefined } from "../../lib/checks/checks.js";
import {
  DetailedReviewListItem,
  DetailedWorkData,
  DetailedWorkListItem,
  ListInsertDto,
  SharedReviewResponse,
} from "../../lib/types/lists.js";

import { useAuthStore } from "@/stores/auth";

export const BASE_IMAGE_URL = "https://image.tmdb.org/t/p/w154/";
export const OPTIMISTIC_WORK_ID = "temp";

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const clubListsKey = (clubSlug: string) => ["lists", clubSlug] as const;

export const listKey = (clubSlug: string, listId: string) =>
  ["list", clubSlug, listId] as const;

export const reviewsListKey = (clubSlug: string) =>
  ["list", clubSlug, "reviews"] as const;

export const workDetailsKey = (clubSlug: string, workId: string) =>
  ["workDetails", clubSlug, workId] as const;

// ---------------------------------------------------------------------------
// Club lists collection (the user lists shown in the list switcher)
// ---------------------------------------------------------------------------

export interface ClubListSummary {
  id: string;
  title: string;
  systemType: "reviews" | null;
  itemCount: number;
}

export function useClubLists(
  clubSlug: string,
): UseQueryReturnType<ClubListSummary[], AxiosError> {
  return useQuery({
    queryKey: clubListsKey(clubSlug),
    queryFn: async () =>
      (await axios.get<ClubListSummary[]>(`/api/club/${clubSlug}/list`)).data,
  });
}

export function useReviewsListId(
  clubSlug: string,
): UseQueryReturnType<string, AxiosError> {
  return useQuery({
    queryKey: ["reviewsListId", clubSlug] as const,
    queryFn: async () =>
      (await axios.get<{ id: string }>(`/api/club/${clubSlug}/list/reviews-id`))
        .data.id,
  });
}

const TEMP_LIST_ID = "temp-list";

export function useCreateList(clubSlug: string) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (title: string) =>
      (
        await auth.request.post<ClubListSummary>(`/api/club/${clubSlug}/list`, {
          title,
        })
      ).data,
    onMutate: async (title) => {
      await queryClient.cancelQueries({ queryKey: clubListsKey(clubSlug) });
      const previous = queryClient.getQueryData<ClubListSummary[]>(
        clubListsKey(clubSlug),
      );
      queryClient.setQueryData<ClubListSummary[]>(
        clubListsKey(clubSlug),
        (current) => [
          ...(current ?? []),
          { id: TEMP_LIST_ID, title, systemType: null, itemCount: 0 },
        ],
      );
      return { previous };
    },
    onError: (_err, _title, context) => {
      if (context?.previous) {
        queryClient.setQueryData(clubListsKey(clubSlug), context.previous);
      }
    },
    onSuccess: (newList) => {
      queryClient.setQueryData<ClubListSummary[]>(
        clubListsKey(clubSlug),
        (current) => current?.map((l) => (l.id === TEMP_LIST_ID ? newList : l)),
      );
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: clubListsKey(clubSlug) }),
  });
}

export function useRenameList(clubSlug: string) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ listId, title }: { listId: string; title: string }) =>
      auth.request.put(`/api/club/${clubSlug}/list/${listId}`, { title }),
    onMutate: ({ listId, title }) => {
      queryClient.setQueriesData<ClubListSummary[]>(
        { queryKey: clubListsKey(clubSlug) },
        (current) =>
          current?.map((l) => (l.id === listId ? { ...l, title } : l)),
      );
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: clubListsKey(clubSlug) }),
  });
}

export function useReorderClubLists(clubSlug: string) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (listIds: string[]) =>
      auth.request.put(`/api/club/${clubSlug}/list/reorder`, { listIds }),
    onMutate: async (listIds) => {
      await queryClient.cancelQueries({ queryKey: clubListsKey(clubSlug) });
      const snapshots = queryClient.getQueriesData<ClubListSummary[]>({
        queryKey: clubListsKey(clubSlug),
      });
      for (const [key, data] of snapshots) {
        if (!data) continue;
        const byId = new Map(data.map((l) => [l.id, l]));
        const reordered = listIds.map((id) => byId.get(id)).filter(isDefined);
        queryClient.setQueryData(key, reordered);
      }
      return { snapshots };
    },
    onError: (_err, _listIds, context) => {
      if (!context) return;
      for (const [key, data] of context.snapshots) {
        queryClient.setQueryData(key, data);
      }
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: clubListsKey(clubSlug) }),
  });
}

export function useDeleteList(clubSlug: string) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (listId: string) =>
      auth.request.delete(`/api/club/${clubSlug}/list/${listId}`),
    onMutate: (listId) => {
      queryClient.setQueryData<ClubListSummary[]>(
        clubListsKey(clubSlug),
        (current) => current?.filter((l) => l.id !== listId),
      );
      queryClient.removeQueries({ queryKey: listKey(clubSlug, listId) });
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: clubListsKey(clubSlug) }),
  });
}

// ---------------------------------------------------------------------------
// Single list (items)
// ---------------------------------------------------------------------------

export function useList(
  clubSlug: string,
  listId: MaybeRef<string>,
): UseQueryReturnType<DetailedWorkListItem[], AxiosError> {
  const listIdRef = computed(() => unref(listId));
  return useQuery({
    queryKey: computed(() => listKey(clubSlug, listIdRef.value)),
    queryFn: async () =>
      (
        await axios.get<DetailedWorkListItem[]>(
          `/api/club/${clubSlug}/list/${listIdRef.value}`,
        )
      ).data,
    enabled: () => listIdRef.value !== "",
  });
}

export interface UserListItemWithSource extends DetailedWorkListItem {
  sourceListId: string;
  sourceListTitle: string;
}

export function useAllUserListItems(
  clubSlug: string,
): UseQueryReturnType<UserListItemWithSource[], AxiosError> {
  return useQuery({
    queryKey: ["lists", clubSlug, "all-items"] as const,
    queryFn: async () =>
      (
        await axios.get<UserListItemWithSource[]>(
          `/api/club/${clubSlug}/list/all-items`,
        )
      ).data,
  });
}

/**
 * Full external metadata (including the cast list) for one work. Bulk list
 * payloads carry only summaries, so detail drawers fetch this on demand.
 */
export function useWorkDetails(
  clubSlug: string,
  workId: MaybeRef<string>,
): UseQueryReturnType<DetailedWorkData | null, AxiosError> {
  const workIdRef = computed(() => unref(workId));
  return useQuery({
    queryKey: computed(() => workDetailsKey(clubSlug, workIdRef.value)),
    queryFn: async () =>
      (
        await axios.get<DetailedWorkData | null>(
          `/api/club/${clubSlug}/work/${workIdRef.value}/details`,
        )
      ).data,
    // Cast/crew of a released work is effectively immutable; cache it for the
    // session so reopening a drawer doesn't refetch.
    staleTime: Infinity,
    enabled: () =>
      workIdRef.value !== "" && workIdRef.value !== OPTIMISTIC_WORK_ID,
  });
}

export function useQueueReview(clubSlug: string) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      workId,
      sourceListId,
      reviewsListId,
    }: {
      workId: string;
      sourceListId?: string;
      reviewsListId: string;
    }) => {
      if (!hasValue(sourceListId)) return;
      if (sourceListId === reviewsListId) return;
      return auth.request.post(
        `/api/club/${clubSlug}/list/${sourceListId}/items/${workId}/move`,
        { destinationListId: reviewsListId },
      );
    },
    // Optimistically remove the work from its source list so the UI reacts
    // immediately; the reviews page picks it up via invalidation.
    onMutate: ({ workId, sourceListId }) => {
      if (!hasValue(sourceListId)) return;
      queryClient.setQueryData<DetailedWorkListItem[]>(
        listKey(clubSlug, sourceListId),
        (current) => current?.filter((item) => item.id !== workId),
      );
      queryClient.setQueryData<UserListItemWithSource[]>(
        ["lists", clubSlug, "all-items"],
        (current) => current?.filter((item) => item.id !== workId),
      );
    },
    onSettled: async (_data, _err, vars) => {
      const invalidations = [
        queryClient.invalidateQueries({ queryKey: reviewsListKey(clubSlug) }),
        queryClient.invalidateQueries({ queryKey: clubListsKey(clubSlug) }),
        queryClient.invalidateQueries({
          queryKey: ["lists", clubSlug, "all-items"],
        }),
      ];
      if (hasValue(vars.sourceListId)) {
        invalidations.push(
          queryClient.invalidateQueries({
            queryKey: listKey(clubSlug, vars.sourceListId),
          }),
        );
      }
      await Promise.all(invalidations);
    },
  });
}

export function useAddToReviewsList(clubSlug: string) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      insertDto,
      reviewsListId,
    }: {
      insertDto: ListInsertDto;
      reviewsListId: string;
    }) =>
      auth.request.post(
        `/api/club/${clubSlug}/list/${reviewsListId}/items`,
        insertDto,
      ),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: reviewsListKey(clubSlug) }),
  });
}

export function useDeleteReview(clubSlug: string) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      workId,
      reviewsListId,
    }: {
      workId: string;
      reviewsListId: string;
    }) =>
      auth.request.delete(
        `/api/club/${clubSlug}/list/${reviewsListId}/items/${workId}`,
      ),
    onMutate: ({ workId }) => {
      queryClient.setQueryData<DetailedReviewListItem[]>(
        reviewsListKey(clubSlug),
        (current) => current?.filter((item) => item.id !== workId),
      );
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: reviewsListKey(clubSlug) }),
  });
}

export function useReviewsList(
  clubSlug: string,
): UseQueryReturnType<DetailedReviewListItem[], AxiosError> {
  return useQuery({
    queryKey: reviewsListKey(clubSlug),
    queryFn: async () =>
      (
        await axios.get<DetailedReviewListItem[]>(
          `/api/club/${clubSlug}/list/reviews`,
        )
      ).data,
    // Scores are collaborative: everyone's ratings live in this payload, so it
    // must revalidate on every mount (including a hard refresh) rather than
    // inherit the global 60s staleTime. Cached data still paints instantly; the
    // refetch runs in the background so refreshing always reflects others'
    // latest scores instead of a stale snapshot.
    staleTime: 0,
  });
}

export function useAddListItem(clubSlug: string, listId: string) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (insertDto: ListInsertDto) =>
      auth.request.post(
        `/api/club/${clubSlug}/list/${listId}/items`,
        insertDto,
      ),
    onMutate: (insertDto) => {
      queryClient.setQueryData<DetailedWorkListItem[]>(
        listKey(clubSlug, listId),
        (currentList) => {
          if (!currentList) return currentList;
          return [
            ...currentList,
            {
              id: OPTIMISTIC_WORK_ID,
              type: insertDto.type,
              title: insertDto.title,
              createdDate: new Date().toISOString(),
              externalId: insertDto.externalId,
              imageUrl: insertDto.imageUrl,
            },
          ];
        },
      );
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: listKey(clubSlug, listId) }),
        queryClient.invalidateQueries({ queryKey: clubListsKey(clubSlug) }),
      ]);
    },
  });
}

export function useDeleteListItem(clubSlug: string, listId: string) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (workId: string) =>
      auth.request.delete(
        `/api/club/${clubSlug}/list/${listId}/items/${workId}`,
      ),
    onMutate: (workId) => {
      if (!workId) return;
      queryClient.setQueryData<DetailedWorkListItem[]>(
        listKey(clubSlug, listId),
        (currentList) => currentList?.filter((item) => item.id !== workId),
      );
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: listKey(clubSlug, listId) }),
        queryClient.invalidateQueries({ queryKey: clubListsKey(clubSlug) }),
      ]);
    },
  });
}

export function useReorderList(clubSlug: string, listId: string) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (workIds: string[]) =>
      auth.request.put(`/api/club/${clubSlug}/list/${listId}/reorder`, {
        workIds,
      }),
    onMutate: async (workIds) => {
      await queryClient.cancelQueries({
        queryKey: listKey(clubSlug, listId),
      });
      const previousList = queryClient.getQueryData<DetailedWorkListItem[]>(
        listKey(clubSlug, listId),
      );
      queryClient.setQueryData<DetailedWorkListItem[]>(
        listKey(clubSlug, listId),
        (currentList) => {
          if (!currentList) return currentList;
          const itemMap = new Map(currentList.map((item) => [item.id, item]));
          return workIds.map((id) => itemMap.get(id)).filter(isDefined);
        },
      );
      return { previousList };
    },
    onError: (_err, _workIds, context) => {
      if (context?.previousList) {
        queryClient.setQueryData(
          listKey(clubSlug, listId),
          context.previousList,
        );
      }
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: listKey(clubSlug, listId) }),
  });
}

export function useMoveListItem(clubSlug: string) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      sourceListId,
      destinationListId,
      workId,
    }: {
      sourceListId: string;
      destinationListId: string;
      workId: string;
    }) =>
      auth.request.post(
        `/api/club/${clubSlug}/list/${sourceListId}/items/${workId}/move`,
        { destinationListId },
      ),
    onMutate: ({ sourceListId, destinationListId, workId }) => {
      const sourceItems = queryClient.getQueryData<DetailedWorkListItem[]>(
        listKey(clubSlug, sourceListId),
      );
      const movingItem = sourceItems?.find((item) => item.id === workId);
      queryClient.setQueryData<DetailedWorkListItem[]>(
        listKey(clubSlug, sourceListId),
        (current) => current?.filter((item) => item.id !== workId),
      );
      if (movingItem) {
        queryClient.setQueryData<DetailedWorkListItem[]>(
          listKey(clubSlug, destinationListId),
          (current) => (current ? [...current, movingItem] : [movingItem]),
        );
      }
    },
    onSettled: async (_data, _err, vars) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: listKey(clubSlug, vars.sourceListId),
        }),
        queryClient.invalidateQueries({
          queryKey: listKey(clubSlug, vars.destinationListId),
        }),
        queryClient.invalidateQueries({ queryKey: clubListsKey(clubSlug) }),
        // The reviews page uses a separate cached shape keyed by
        // reviewsListKey; invalidate it so moving an item into the reviews
        // system list makes the review appear there.
        queryClient.invalidateQueries({ queryKey: reviewsListKey(clubSlug) }),
      ]);
    },
  });
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

export function useNextWork(clubSlug: string) {
  return useQuery({
    queryKey: ["nextWork", clubSlug],
    queryFn: async () => {
      const response = await axios.get<{ workId?: string }>(
        `/api/club/${clubSlug}/nextWork`,
      );
      return response.data.workId ?? null;
    },
  });
}

export function useSetNextWork(clubSlug: string) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (workId: string) =>
      auth.request.put(`/api/club/${clubSlug}/nextWork`, { workId }),
    onMutate: (workId) => {
      if (!workId) return;
      queryClient.setQueryData<string>(["nextWork", clubSlug], () => workId);
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ["nextWork", clubSlug] }),
  });
}

export function useClearNextWork(clubSlug: string) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => auth.request.delete(`/api/club/${clubSlug}/nextWork`),
    onMutate: () => {
      queryClient.setQueryData<string | null>(["nextWork", clubSlug], null);
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ["nextWork", clubSlug] }),
  });
}

export function useSharedReview(
  clubSlug: string,
  workId: string,
): UseQueryReturnType<SharedReviewResponse, AxiosError> {
  return useQuery({
    queryKey: ["sharedReview", clubSlug, workId],
    queryFn: async () =>
      (
        await axios.get<{ data: SharedReviewResponse }>(
          `/api/club/${clubSlug}/reviews/${workId}/shared`,
        )
      ).data,
  });
}

/**
 * Updates a review item's added-date. Reviews live on the system reviews
 * list, so the caller passes the resolved reviews list ID.
 */
export function useUpdateAddedDate(clubSlug: string) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      listId,
      workId,
      addedDate,
    }: {
      listId: string;
      workId: string;
      addedDate: string;
    }) =>
      auth.request.put(
        `/api/club/${clubSlug}/list/${listId}/items/${workId}/added-date`,
        { addedDate },
      ),
    onMutate: ({ workId, addedDate }) => {
      queryClient.setQueryData<DetailedReviewListItem[]>(
        reviewsListKey(clubSlug),
        (currentList) => {
          if (!currentList) return currentList;
          return currentList.map((item) =>
            item.id === workId ? { ...item, createdDate: addedDate } : item,
          );
        },
      );
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: reviewsListKey(clubSlug) }),
  });
}
