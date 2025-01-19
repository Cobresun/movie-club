import {
  UseQueryReturnType,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/vue-query";
import axios, { AxiosError } from "axios";

import { WorkListType } from "../../lib/types/generated/db.js";
import {
  DetailedReviewListItem,
  DetailedWorkListItem,
  ListInsertDto,
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

export function useNextWork(clubId: string) {
  return useQuery({
    queryKey: ["nextWork", clubId],
    queryFn: async () =>
      (await axios.get<{ workId?: string }>(`/api/club/${clubId}/nextWork`))
        .data.workId,
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
