import {
  QueryClient,
  UseQueryReturnType,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/vue-query";
import axios, { AxiosError } from "axios";
import { computed, unref, type MaybeRef } from "vue";
import { useToast } from "vue-toastification";

import { hasValue, isDefined } from "../../lib/checks/checks.js";
import {
  DetailedReviewListItem,
  DetailedWorkData,
  DetailedWorkListItem,
  ListInsertDto,
  SharedReviewResponse,
} from "../../lib/types/lists.js";
import { memberScoresKey } from "./useUser";
import { useAuthStore } from "@/stores/auth";

export const BASE_IMAGE_URL = "https://image.tmdb.org/t/p/w154/";
export const OPTIMISTIC_WORK_ID = "temp";

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const clubListsKey = (clubSlug: string) => ["lists", clubSlug] as const;

export const listKey = (clubSlug: string, listId: string) => ["list", clubSlug, listId] as const;

export const reviewsListKey = (clubSlug: string) => ["list", clubSlug, "reviews"] as const;

export const workDetailsKey = (clubSlug: string, workId: string) =>
  ["workDetails", clubSlug, workId] as const;

const reviewsListIdKey = (clubSlug: string) => ["reviewsListId", clubSlug] as const;

const allUserListItemsKey = (clubSlug: string) => ["lists", clubSlug, "all-items"] as const;

/**
 * Puts a work at the top of the reviews page (newest first, as the server
 * orders it) before the write that adds it has landed. It carries the
 * optimistic id until the settle refetch replaces it, so the page shows it as
 * pending rather than letting anyone score a work the server may not have yet.
 */
async function addPendingReview(
  queryClient: QueryClient,
  clubSlug: string,
  work: Omit<DetailedWorkListItem, "id" | "createdDate">,
) {
  await queryClient.cancelQueries({ queryKey: reviewsListKey(clubSlug) });
  queryClient.setQueryData<DetailedReviewListItem[]>(reviewsListKey(clubSlug), (current) =>
    isDefined(current)
      ? [
          {
            ...work,
            id: OPTIMISTIC_WORK_ID,
            createdDate: new Date().toISOString(),
            scores: {},
          },
          ...current,
        ]
      : current,
  );
}

// ---------------------------------------------------------------------------
// Club lists collection (the user lists shown in the list switcher)
// ---------------------------------------------------------------------------

export interface ClubListSummary {
  id: string;
  title: string;
  systemType: "reviews" | null;
  itemCount: number;
}

export function useClubLists(clubSlug: string): UseQueryReturnType<ClubListSummary[], AxiosError> {
  return useQuery({
    queryKey: clubListsKey(clubSlug),
    queryFn: async () => (await axios.get<ClubListSummary[]>(`/api/club/${clubSlug}/list`)).data,
  });
}

export function useReviewsListId(clubSlug: string): UseQueryReturnType<string, AxiosError> {
  return useQuery({
    queryKey: reviewsListIdKey(clubSlug),
    queryFn: async () =>
      (await axios.get<{ id: string }>(`/api/club/${clubSlug}/list/reviews-id`)).data.id,
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
      const previous = queryClient.getQueryData<ClubListSummary[]>(clubListsKey(clubSlug));
      queryClient.setQueryData<ClubListSummary[]>(clubListsKey(clubSlug), (current) => [
        ...(current ?? []),
        { id: TEMP_LIST_ID, title, systemType: null, itemCount: 0 },
      ]);
      return { previous };
    },
    onError: (_err, _title, context) => {
      if (context?.previous) {
        queryClient.setQueryData(clubListsKey(clubSlug), context.previous);
      }
    },
    onSuccess: (newList) => {
      queryClient.setQueryData<ClubListSummary[]>(clubListsKey(clubSlug), (current) =>
        current?.map((l) => (l.id === TEMP_LIST_ID ? newList : l)),
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: clubListsKey(clubSlug) }),
  });
}

export function useRenameList(clubSlug: string) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ listId, title }: { listId: string; title: string }) =>
      auth.request.put(`/api/club/${clubSlug}/list/${listId}`, { title }),
    onMutate: async ({ listId, title }) => {
      await queryClient.cancelQueries({ queryKey: clubListsKey(clubSlug) });
      queryClient.setQueriesData<ClubListSummary[]>(
        { queryKey: clubListsKey(clubSlug) },
        (current) => current?.map((l) => (l.id === listId ? { ...l, title } : l)),
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: clubListsKey(clubSlug) }),
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
    onSettled: () => queryClient.invalidateQueries({ queryKey: clubListsKey(clubSlug) }),
  });
}

export function useDeleteList(clubSlug: string) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (listId: string) => auth.request.delete(`/api/club/${clubSlug}/list/${listId}`),
    onMutate: async (listId) => {
      await queryClient.cancelQueries({ queryKey: clubListsKey(clubSlug) });
      queryClient.setQueryData<ClubListSummary[]>(clubListsKey(clubSlug), (current) =>
        current?.filter((l) => l.id !== listId),
      );
      queryClient.removeQueries({ queryKey: listKey(clubSlug, listId) });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: clubListsKey(clubSlug) }),
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
      (await axios.get<DetailedWorkListItem[]>(`/api/club/${clubSlug}/list/${listIdRef.value}`))
        .data,
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
    queryKey: allUserListItemsKey(clubSlug),
    queryFn: async () =>
      (await axios.get<UserListItemWithSource[]>(`/api/club/${clubSlug}/list/all-items`)).data,
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
    enabled: () => workIdRef.value !== "" && workIdRef.value !== OPTIMISTIC_WORK_ID,
  });
}

export function useQueueReview(clubSlug: string) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  const toast = useToast();
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
      return auth.request.post(`/api/club/${clubSlug}/list/${sourceListId}/items/${workId}/move`, {
        destinationListId: reviewsListId,
      });
    },
    // Both ends of the move: the work leaves its source list and appears,
    // pending, on the reviews page.
    onMutate: async ({ workId, sourceListId, reviewsListId }) => {
      if (!hasValue(sourceListId) || sourceListId === reviewsListId) return;
      await Promise.all([
        queryClient.cancelQueries({ queryKey: listKey(clubSlug, sourceListId) }),
        queryClient.cancelQueries({ queryKey: allUserListItemsKey(clubSlug) }),
      ]);
      const moving =
        queryClient
          .getQueryData<UserListItemWithSource[]>(allUserListItemsKey(clubSlug))
          ?.find((item) => item.id === workId) ??
        queryClient
          .getQueryData<DetailedWorkListItem[]>(listKey(clubSlug, sourceListId))
          ?.find((item) => item.id === workId);
      queryClient.setQueryData<DetailedWorkListItem[]>(listKey(clubSlug, sourceListId), (current) =>
        current?.filter((item) => item.id !== workId),
      );
      queryClient.setQueryData<UserListItemWithSource[]>(allUserListItemsKey(clubSlug), (current) =>
        current?.filter((item) => item.id !== workId),
      );
      if (isDefined(moving)) {
        await addPendingReview(queryClient, clubSlug, {
          type: moving.type,
          title: moving.title,
          externalId: moving.externalId,
          imageUrl: moving.imageUrl,
          externalData: moving.externalData,
        });
      }
    },
    // The prompt that started this has closed by the time a failure comes back.
    onError: () => toast.error("Failed to add the review. Please try again."),
    onSettled: async (_data, _err, vars) => {
      const invalidations = [
        queryClient.invalidateQueries({ queryKey: reviewsListKey(clubSlug) }),
        queryClient.invalidateQueries({ queryKey: clubListsKey(clubSlug) }),
        queryClient.invalidateQueries({ queryKey: allUserListItemsKey(clubSlug) }),
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
  const toast = useToast();
  return useMutation({
    mutationFn: async ({
      insertDto,
      reviewsListId,
    }: {
      insertDto: ListInsertDto;
      reviewsListId: string;
    }) => auth.request.post(`/api/club/${clubSlug}/list/${reviewsListId}/items`, insertDto),
    onMutate: ({ insertDto }) => addPendingReview(queryClient, clubSlug, insertDto),
    // The prompt that started this has closed by the time a failure comes back.
    onError: (_error, { insertDto }) =>
      toast.error(`Failed to add "${insertDto.title}". Please try again.`),
    onSettled: () => queryClient.invalidateQueries({ queryKey: reviewsListKey(clubSlug) }),
  });
}

export function useDeleteReview(clubSlug: string) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ workId, reviewsListId }: { workId: string; reviewsListId: string }) =>
      auth.request.delete(`/api/club/${clubSlug}/list/${reviewsListId}/items/${workId}`),
    onMutate: async ({ workId }) => {
      await queryClient.cancelQueries({ queryKey: reviewsListKey(clubSlug) });
      queryClient.setQueryData<DetailedReviewListItem[]>(reviewsListKey(clubSlug), (current) =>
        current?.filter((item) => item.id !== workId),
      );
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: reviewsListKey(clubSlug) }),
        queryClient.invalidateQueries({ queryKey: memberScoresKey }),
      ]);
    },
  });
}

export function useReviewsList(
  clubSlug: string,
): UseQueryReturnType<DetailedReviewListItem[], AxiosError> {
  return useQuery({
    queryKey: reviewsListKey(clubSlug),
    queryFn: async () =>
      (await axios.get<DetailedReviewListItem[]>(`/api/club/${clubSlug}/list/reviews`)).data,
  });
}

export function useAddListItem(clubSlug: string, listId: string) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (insertDto: ListInsertDto) =>
      auth.request.post(`/api/club/${clubSlug}/list/${listId}/items`, insertDto),
    onMutate: async (insertDto) => {
      await queryClient.cancelQueries({ queryKey: listKey(clubSlug, listId) });
      queryClient.setQueryData<DetailedWorkListItem[]>(listKey(clubSlug, listId), (currentList) => {
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
      });
    },
    // Toast lives here (not at the mutate() call site) so it still fires after
    // the Add modal unmounts on close — mutate() callbacks are dropped on unmount.
    onSuccess: (_data, insertDto) => toast.success(`Added "${insertDto.title}" to the list`),
    onError: (_error, insertDto) =>
      toast.error(`Failed to add "${insertDto.title}". Please try again.`),
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
      auth.request.delete(`/api/club/${clubSlug}/list/${listId}/items/${workId}`),
    onMutate: async (workId) => {
      if (!workId) return;
      await queryClient.cancelQueries({ queryKey: listKey(clubSlug, listId) });
      queryClient.setQueryData<DetailedWorkListItem[]>(listKey(clubSlug, listId), (currentList) =>
        currentList?.filter((item) => item.id !== workId),
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
      queryClient.setQueryData<DetailedWorkListItem[]>(listKey(clubSlug, listId), (currentList) => {
        if (!currentList) return currentList;
        const itemMap = new Map(currentList.map((item) => [item.id, item]));
        return workIds.map((id) => itemMap.get(id)).filter(isDefined);
      });
      return { previousList };
    },
    onError: (_err, _workIds, context) => {
      if (context?.previousList) {
        queryClient.setQueryData(listKey(clubSlug, listId), context.previousList);
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: listKey(clubSlug, listId) }),
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
      auth.request.post(`/api/club/${clubSlug}/list/${sourceListId}/items/${workId}/move`, {
        destinationListId,
      }),
    onMutate: async ({ sourceListId, destinationListId, workId }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: listKey(clubSlug, sourceListId) }),
        queryClient.cancelQueries({ queryKey: listKey(clubSlug, destinationListId) }),
      ]);
      const sourceItems = queryClient.getQueryData<DetailedWorkListItem[]>(
        listKey(clubSlug, sourceListId),
      );
      const movingItem = sourceItems?.find((item) => item.id === workId);
      queryClient.setQueryData<DetailedWorkListItem[]>(listKey(clubSlug, sourceListId), (current) =>
        current?.filter((item) => item.id !== workId),
      );
      if (movingItem) {
        queryClient.setQueryData<DetailedWorkListItem[]>(
          listKey(clubSlug, destinationListId),
          (current) => (current ? [...current, movingItem] : [movingItem]),
        );
        // The reviews page reads its own richer shape, not the list's.
        if (queryClient.getQueryData<string>(reviewsListIdKey(clubSlug)) === destinationListId) {
          await addPendingReview(queryClient, clubSlug, {
            type: movingItem.type,
            title: movingItem.title,
            externalId: movingItem.externalId,
            imageUrl: movingItem.imageUrl,
            externalData: movingItem.externalData,
          });
        }
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
      const response = await axios.get<{ workId?: string }>(`/api/club/${clubSlug}/nextWork`);
      return response.data.workId ?? null;
    },
  });
}

export function useSetNextWork(clubSlug: string) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (workId: string) => auth.request.put(`/api/club/${clubSlug}/nextWork`, { workId }),
    onMutate: async (workId) => {
      if (!workId) return;
      await queryClient.cancelQueries({ queryKey: ["nextWork", clubSlug] });
      queryClient.setQueryData<string>(["nextWork", clubSlug], () => workId);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["nextWork", clubSlug] }),
  });
}

export function useClearNextWork(clubSlug: string) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => auth.request.delete(`/api/club/${clubSlug}/nextWork`),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["nextWork", clubSlug] });
      queryClient.setQueryData<string | null>(["nextWork", clubSlug], null);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["nextWork", clubSlug] }),
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
      auth.request.put(`/api/club/${clubSlug}/list/${listId}/items/${workId}/added-date`, {
        addedDate,
      }),
    onMutate: async ({ workId, addedDate }) => {
      await queryClient.cancelQueries({ queryKey: reviewsListKey(clubSlug) });
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
    onSettled: () => queryClient.invalidateQueries({ queryKey: reviewsListKey(clubSlug) }),
  });
}
