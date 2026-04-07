import {
  UseQueryReturnType,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/vue-query";
import axios, { AxiosError } from "axios";
import { computed, unref, type MaybeRef } from "vue";

import { isDefined } from "../../lib/checks/checks.js";
import {
  DetailedReviewListItem,
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

// ---------------------------------------------------------------------------
// Club lists collection (the user lists shown in the list switcher)
// ---------------------------------------------------------------------------

export interface ClubListSummary {
  id: string;
  title: string;
  systemType: "reviews" | "award_nominations" | null;
  itemCount: number;
}

export function useClubLists(
  clubSlug: string,
  options: { includeSystem?: boolean } = {},
): UseQueryReturnType<ClubListSummary[], AxiosError> {
  const includeSystem = options.includeSystem === true;
  return useQuery({
    queryKey: [...clubListsKey(clubSlug), { includeSystem }] as const,
    queryFn: async () =>
      (
        await axios.get<ClubListSummary[]>(`/api/club/${clubSlug}/list`, {
          params: includeSystem ? { includeSystem: "true" } : undefined,
        })
      ).data,
  });
}

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
      queryClient.setQueryData<ClubListSummary[]>(
        clubListsKey(clubSlug),
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
        const reordered: ClubListSummary[] = [];
        for (const id of listIds) {
          const l = byId.get(id);
          if (l) reordered.push(l);
        }
        // Append any lists missing from the payload (e.g. a hidden system
        // list that the frontend didn't include in the drag) so we don't
        // lose rows from the cache.
        for (const l of data) {
          if (!listIds.includes(l.id)) reordered.push(l);
        }
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

export function useUpdateReviewAddedDate(clubSlug: string) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      workId,
      addedDate,
    }: {
      workId: string;
      addedDate: string;
    }) => {
      const lists = (
        await axios.get<ClubListSummary[]>(`/api/club/${clubSlug}/list`, {
          params: { includeSystem: "true" },
        })
      ).data;
      const reviewsList = lists.find((l) => l.systemType === "reviews");
      if (!reviewsList) throw new Error("Reviews list not found");
      return auth.request.put(
        `/api/club/${clubSlug}/list/${reviewsList.id}/items/${workId}/added-date`,
        { addedDate },
      );
    },
    onMutate: ({ workId, addedDate }) => {
      queryClient.setQueryData<DetailedReviewListItem[]>(
        reviewsListKey(clubSlug),
        (currentList) =>
          currentList?.map((item) =>
            item.id === workId ? { ...item, createdDate: addedDate } : item,
          ),
      );
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: reviewsListKey(clubSlug) }),
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
    queryFn: async () => {
      const lists = (
        await axios.get<ClubListSummary[]>(`/api/club/${clubSlug}/list`)
      ).data;
      const perList = await Promise.all(
        lists.map(async (list) => {
          const items = (
            await axios.get<DetailedWorkListItem[]>(
              `/api/club/${clubSlug}/list/${list.id}`,
            )
          ).data;
          return items.map<UserListItemWithSource>((item) => ({
            ...item,
            sourceListId: list.id,
            sourceListTitle: list.title,
          }));
        }),
      );
      return perList.flat();
    },
  });
}

export function useQueueReview(clubSlug: string) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      workId,
      sourceListId,
    }: {
      workId: string;
      sourceListId?: string;
    }) =>
      auth.request.post(`/api/club/${clubSlug}/reviews/${workId}/queue`, {
        sourceListId,
      }),
    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: reviewsListKey(clubSlug),
      });
      await queryClient.invalidateQueries({ queryKey: clubListsKey(clubSlug) });
      await queryClient.invalidateQueries({
        queryKey: ["lists", clubSlug, "all-items"],
      });
    },
  });
}

export function useAddToReviewsList(clubSlug: string) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (insertDto: ListInsertDto) => {
      const lists = (
        await axios.get<ClubListSummary[]>(`/api/club/${clubSlug}/list`, {
          params: { includeSystem: "true" },
        })
      ).data;
      const reviewsList = lists.find((l) => l.systemType === "reviews");
      if (!reviewsList) throw new Error("Reviews list not found");
      return auth.request.post(
        `/api/club/${clubSlug}/list/${reviewsList.id}/items`,
        insertDto,
      );
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: reviewsListKey(clubSlug) }),
  });
}

export function useDeleteReview(clubSlug: string) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (workId: string) =>
      auth.request.delete(`/api/club/${clubSlug}/reviews/${workId}`),
    onMutate: (workId) => {
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
      await queryClient.invalidateQueries({
        queryKey: listKey(clubSlug, listId),
      });
      await queryClient.invalidateQueries({
        queryKey: clubListsKey(clubSlug),
      });
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
      await queryClient.invalidateQueries({
        queryKey: listKey(clubSlug, listId),
      });
      await queryClient.invalidateQueries({
        queryKey: clubListsKey(clubSlug),
      });
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
    onMutate: ({ sourceListId, workId }) => {
      queryClient.setQueryData<DetailedWorkListItem[]>(
        listKey(clubSlug, sourceListId),
        (current) => current?.filter((item) => item.id !== workId),
      );
    },
    onSettled: async (_data, _err, vars) => {
      await queryClient.invalidateQueries({
        queryKey: listKey(clubSlug, vars.sourceListId),
      });
      await queryClient.invalidateQueries({
        queryKey: listKey(clubSlug, vars.destinationListId),
      });
      await queryClient.invalidateQueries({
        queryKey: clubListsKey(clubSlug),
      });
      // The reviews page uses a separate cached shape keyed by reviewsListKey;
      // invalidate it so moving an item into the reviews system list makes
      // the review appear there.
      await queryClient.invalidateQueries({
        queryKey: reviewsListKey(clubSlug),
      });
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
 * list, so the caller passes the resolved reviews list ID (looked up from
 * useClubLists with includeSystem, or via a future helper).
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
