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
  clubSlug: string,
  type: WorkListType.reviews,
): UseQueryReturnType<DetailedReviewListItem[], AxiosError>;
export function useList(
  clubSlug: string,
  type: WorkListType.backlog | WorkListType.watchlist,
): UseQueryReturnType<DetailedWorkListItem[], AxiosError>;
export function useList(
  clubSlug: string,
  type: WorkListType,
): UseQueryReturnType<DetailedWorkListItem[], AxiosError> {
  return useQuery({
    queryKey: ["list", clubSlug, type],
    queryFn: async () =>
      (
        await axios.get<DetailedWorkListItem[] | DetailedReviewListItem[]>(
          `/api/club/${clubSlug}/list/${type}`,
        )
      ).data,
  });
}

export function useAddListItem(clubSlug: string, type: WorkListType) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (insertDto: ListInsertDto) =>
      auth.request.post(`/api/club/${clubSlug}/list/${type}`, insertDto),
    onMutate: (insertDto) => {
      queryClient.setQueryData<
        DetailedWorkListItem[] | DetailedReviewListItem[]
      >(["list", clubSlug, type], (currentList) => {
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
        queryKey: ["list", clubSlug, type],
      }),
  });
}

export function useDeleteListItem(clubSlug: string, type: WorkListType) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (workId: string) =>
      auth.request.delete(`/api/club/${clubSlug}/list/${type}/${workId}`),
    onMutate: (workId) => {
      if (!workId) return;
      queryClient.setQueryData<DetailedWorkListItem[]>(
        ["list", clubSlug, type],
        (currentList) => {
          if (!currentList) return currentList;
          return currentList.filter((item) => item.id !== workId);
        },
      );
    },
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: ["list", clubSlug, type],
      }),
  });
}

export function useReorderList(
  clubSlug: string,
  type: WorkListType.watchlist | WorkListType.backlog,
) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (workIds: string[]) =>
      auth.request.put(`/api/club/${clubSlug}/list/${type}/reorder`, {
        workIds,
      }),
    onMutate: async (workIds) => {
      await queryClient.cancelQueries({
        queryKey: ["list", clubSlug, type],
      });
      const previousList = queryClient.getQueryData<DetailedWorkListItem[]>([
        "list",
        clubSlug,
        type,
      ]);
      queryClient.setQueryData<DetailedWorkListItem[]>(
        ["list", clubSlug, type],
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
          ["list", clubSlug, type],
          context.previousList,
        );
      }
    },
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: ["list", clubSlug, type],
      }),
  });
}

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

export function useUpdateAddedDate(clubSlug: string) {
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
        `/api/club/${clubSlug}/list/${WorkListType.reviews}/${workId}/added-date`,
        { addedDate },
      ),
    onMutate: ({ workId, addedDate }) => {
      queryClient.setQueryData<DetailedReviewListItem[]>(
        ["list", clubSlug, WorkListType.reviews],
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
        queryKey: ["list", clubSlug, WorkListType.reviews],
      }),
  });
}
