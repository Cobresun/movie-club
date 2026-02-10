import {
  UseQueryReturnType,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/vue-query";
import axios, { AxiosError } from "axios";

import { isDefined } from "../../lib/checks/checks.js";
import { WorkListType } from "../../lib/types/generated/db.js";
import {
  DetailedReviewListItem,
  DetailedWorkListItem,
  ListInsertDto,
  SharedReviewResponse,
} from "../../lib/types/lists.js";

import { useAuthStore } from "@/stores/auth";

export const BASE_IMAGE_URL = "https://image.tmdb.org/t/p/w154/";
export const OPTIMISTIC_WORK_ID = "temp";

export function useList(
  clubId: string,
  type: WorkListType.reviews,
): UseQueryReturnType<DetailedReviewListItem[], AxiosError>;
export function useList(
  clubId: string,
  type: WorkListType.backlog | WorkListType.watchlist,
): UseQueryReturnType<DetailedWorkListItem[], AxiosError>;
export function useList(
  clubId: string,
  type: WorkListType,
): UseQueryReturnType<DetailedWorkListItem[], AxiosError> {
  return useQuery({
    queryKey: ["list", clubId, type],
    queryFn: async () =>
      (
        await axios.get<DetailedWorkListItem[] | DetailedReviewListItem[]>(
          `/api/club/${clubId}/list/${type}`,
        )
      ).data,
  });
}

export function useAddListItem(clubId: string, type: WorkListType) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (insertDto: ListInsertDto) =>
      auth.request.post(`/api/club/${clubId}/list/${type}`, insertDto),
    onMutate: (insertDto) => {
      queryClient.setQueryData<
        DetailedWorkListItem[] | DetailedReviewListItem[]
      >(["list", clubId, type], (currentList) => {
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
            scores: type === WorkListType.reviews ? {} : undefined,
          },
        ];
      });
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ["list", clubId, type] }),
  });
}

export function useDeleteListItem(clubId: string, type: WorkListType) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (workId: string) =>
      auth.request.delete(`/api/club/${clubId}/list/${type}/${workId}`),
    onMutate: (workId) => {
      if (!workId) return;
      queryClient.setQueryData<DetailedWorkListItem[]>(
        ["list", clubId, type],
        (currentList) => {
          if (!currentList) return currentList;
          return currentList.filter((item) => item.id !== workId);
        },
      );
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ["list", clubId, type] }),
  });
}

export function useReorderList(
  clubId: string,
  type: WorkListType.watchlist | WorkListType.backlog,
) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (workIds: string[]) =>
      auth.request.put(`/api/club/${clubId}/list/${type}/reorder`, { workIds }),
    onMutate: async (workIds) => {
      await queryClient.cancelQueries({ queryKey: ["list", clubId, type] });
      const previousList = queryClient.getQueryData<DetailedWorkListItem[]>([
        "list",
        clubId,
        type,
      ]);
      queryClient.setQueryData<DetailedWorkListItem[]>(
        ["list", clubId, type],
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
        queryClient.setQueryData(["list", clubId, type], context.previousList);
      }
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ["list", clubId, type] }),
  });
}

export function useNextWork(clubId: string) {
  return useQuery({
    queryKey: ["nextWork", clubId],
    queryFn: async () => {
      const response = await axios.get<{ workId?: string }>(
        `/api/club/${clubId}/nextWork`,
      );
      return response.data.workId ?? null;
    },
  });
}

export function useSetNextWork(clubId: string) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (workId: string) =>
      auth.request.put(`/api/club/${clubId}/nextWork`, { workId }),
    onMutate: (workId) => {
      if (!workId) return;
      queryClient.setQueryData<string>(["nextWork", clubId], () => workId);
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ["nextWork", clubId] }),
  });
}

export function useClearNextWork(clubId: string) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => auth.request.delete(`/api/club/${clubId}/nextWork`),
    onMutate: () => {
      queryClient.setQueryData<string | null>(["nextWork", clubId], null);
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ["nextWork", clubId] }),
  });
}

export function useSharedReview(
  clubId: string,
  workId: string,
): UseQueryReturnType<SharedReviewResponse, AxiosError> {
  return useQuery({
    queryKey: ["sharedReview", clubId, workId],
    queryFn: async () =>
      (
        await axios.get<{ data: SharedReviewResponse }>(
          `/api/club/${clubId}/reviews/${workId}/shared`,
        )
      ).data,
  });
}

export function useUpdateAddedDate(clubId: string) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      workId,
      addedDate,
    }: {
      workId: string;
      addedDate: string;
    }) =>
      auth.request.put(
        `/api/club/${clubId}/list/${WorkListType.reviews}/${workId}/added-date`,
        { addedDate },
      ),
    onMutate: ({ workId, addedDate }) => {
      queryClient.setQueryData<DetailedReviewListItem[]>(
        ["list", clubId, WorkListType.reviews],
        (currentList) => {
          if (!currentList) return currentList;
          return currentList.map((item) =>
            item.id === workId ? { ...item, createdDate: addedDate } : item,
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
