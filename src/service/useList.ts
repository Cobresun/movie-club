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
  clubIdentifier: string,
  type: WorkListType.reviews,
): UseQueryReturnType<DetailedReviewListItem[], AxiosError>;
export function useList(
  clubIdentifier: string,
  type: WorkListType.backlog | WorkListType.watchlist,
): UseQueryReturnType<DetailedWorkListItem[], AxiosError>;
export function useList(
  clubIdentifier: string,
  type: WorkListType,
): UseQueryReturnType<DetailedWorkListItem[], AxiosError> {
  return useQuery({
    queryKey: ["list", clubIdentifier, type],
    queryFn: async () =>
      (
        await axios.get<DetailedWorkListItem[] | DetailedReviewListItem[]>(
          `/api/club/${clubIdentifier}/list/${type}`,
        )
      ).data,
  });
}

export function useAddListItem(clubIdentifier: string, type: WorkListType) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (insertDto: ListInsertDto) =>
      auth.request.post(`/api/club/${clubIdentifier}/list/${type}`, insertDto),
    onMutate: (insertDto) => {
      queryClient.setQueryData<
        DetailedWorkListItem[] | DetailedReviewListItem[]
      >(["list", clubIdentifier, type], (currentList) => {
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
      queryClient.invalidateQueries({
        queryKey: ["list", clubIdentifier, type],
      }),
  });
}

export function useDeleteListItem(clubIdentifier: string, type: WorkListType) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (workId: string) =>
      auth.request.delete(`/api/club/${clubIdentifier}/list/${type}/${workId}`),
    onMutate: (workId) => {
      if (!workId) return;
      queryClient.setQueryData<DetailedWorkListItem[]>(
        ["list", clubIdentifier, type],
        (currentList) => {
          if (!currentList) return currentList;
          return currentList.filter((item) => item.id !== workId);
        },
      );
    },
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: ["list", clubIdentifier, type],
      }),
  });
}

export function useReorderList(
  clubIdentifier: string,
  type: WorkListType.watchlist | WorkListType.backlog,
) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (workIds: string[]) =>
      auth.request.put(`/api/club/${clubIdentifier}/list/${type}/reorder`, {
        workIds,
      }),
    onMutate: async (workIds) => {
      await queryClient.cancelQueries({
        queryKey: ["list", clubIdentifier, type],
      });
      const previousList = queryClient.getQueryData<DetailedWorkListItem[]>([
        "list",
        clubIdentifier,
        type,
      ]);
      queryClient.setQueryData<DetailedWorkListItem[]>(
        ["list", clubIdentifier, type],
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
          ["list", clubIdentifier, type],
          context.previousList,
        );
      }
    },
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: ["list", clubIdentifier, type],
      }),
  });
}

export function useNextWork(clubIdentifier: string) {
  return useQuery({
    queryKey: ["nextWork", clubIdentifier],
    queryFn: async () => {
      const response = await axios.get<{ workId?: string }>(
        `/api/club/${clubIdentifier}/nextWork`,
      );
      return response.data.workId ?? null;
    },
  });
}

export function useSetNextWork(clubIdentifier: string) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (workId: string) =>
      auth.request.put(`/api/club/${clubIdentifier}/nextWork`, { workId }),
    onMutate: (workId) => {
      if (!workId) return;
      queryClient.setQueryData<string>(
        ["nextWork", clubIdentifier],
        () => workId,
      );
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ["nextWork", clubIdentifier] }),
  });
}

export function useClearNextWork(clubIdentifier: string) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      auth.request.delete(`/api/club/${clubIdentifier}/nextWork`),
    onMutate: () => {
      queryClient.setQueryData<string | null>(
        ["nextWork", clubIdentifier],
        null,
      );
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ["nextWork", clubIdentifier] }),
  });
}

export function useSharedReview(
  clubIdentifier: string,
  workId: string,
): UseQueryReturnType<SharedReviewResponse, AxiosError> {
  return useQuery({
    queryKey: ["sharedReview", clubIdentifier, workId],
    queryFn: async () =>
      (
        await axios.get<{ data: SharedReviewResponse }>(
          `/api/club/${clubIdentifier}/reviews/${workId}/shared`,
        )
      ).data,
  });
}

export function useUpdateAddedDate(clubIdentifier: string) {
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
        `/api/club/${clubIdentifier}/list/${WorkListType.reviews}/${workId}/added-date`,
        { addedDate },
      ),
    onMutate: ({ workId, addedDate }) => {
      queryClient.setQueryData<DetailedReviewListItem[]>(
        ["list", clubIdentifier, WorkListType.reviews],
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
        queryKey: ["list", clubIdentifier, WorkListType.reviews],
      }),
  });
}
