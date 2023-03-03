import {
  useMutation,
  useQuery,
  useQueryClient,
  UseQueryReturnType,
} from "@tanstack/vue-query";
import axios, { AxiosError } from "axios";
import { computed, watch } from "vue";

import { useAuthRequest, useRequestCache } from "./useRequest";

import {
  CacheDataService,
  WatchListItem,
  WatchListViewModel,
} from "@/common/types/models";
import { useAuthStore } from "@/stores/auth";
import { useWatchListStore } from "@/stores/watchList";

export function useWatchList(
  clubId: string
): UseQueryReturnType<WatchListViewModel, AxiosError> {
  return useQuery({
    queryKey: ["watchlist", clubId],
    queryFn: async () =>
      (await axios.get(`/api/club/${clubId}/watchList`)).data,
  });
}

export function useAddMovie(clubId: string) {
  const { authToken } = useAuthStore();
  const queryClient = useQueryClient();
  return useMutation(
    (movie: WatchListItem) =>
      axios.post(`/api/club/${clubId}/watchList/${movie.movieId}`, undefined, {
        headers: { Authorization: `Bearer ${authToken}` },
      }),
    {
      onMutate: (movie) => {
        if (!movie) return;
        queryClient.setQueryData<WatchListViewModel>(
          ["watchlist", clubId],
          (currentWatchlist) => {
            if (!currentWatchlist) return currentWatchlist;
            return {
              ...currentWatchlist,
              watchList: [...currentWatchlist.watchList, movie],
            };
          }
        );
      },
      onSettled: () =>
        queryClient.invalidateQueries({ queryKey: ["watchlist", clubId] }),
    }
  );
}

export function useDeleteMovie(clubId: string) {
  const { authToken } = useAuthStore();
  const queryClient = useQueryClient();
  return useMutation(
    (movieId: number) =>
      axios.delete(`/api/club/${clubId}/watchList/${movieId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      }),
    {
      onMutate: async (movieId) => {
        await queryClient.cancelQueries(["watchlist", clubId]);
        queryClient.setQueryData<WatchListViewModel>(
          ["watchlist", clubId],
          (currentWatchlist) => {
            if (!currentWatchlist) return currentWatchlist;
            return {
              ...currentWatchlist,
              watchList: currentWatchlist?.watchList.filter(
                (movie) => movie.movieId !== movieId
              ),
            };
          }
        );
      },
      onSettled: () =>
        queryClient.invalidateQueries({ queryKey: ["watchlist", clubId] }),
    }
  );
}

export function useMakeNextWatch(clubId: string) {
  const { authToken } = useAuthStore();
  const queryClient = useQueryClient();
  return useMutation(
    (movieId: number) =>
      axios.put(
        `/api/club/${clubId}/nextMovie`,
        { nextMovieId: movieId },
        { headers: { Authorization: `Bearer ${authToken}` } }
      ),
    {
      onMutate: async (movieId) => {
        await queryClient.cancelQueries(["watchlist", clubId]);
        queryClient.setQueryData<WatchListViewModel>(
          ["watchlist", clubId],
          (currentWatchlist) => {
            if (!currentWatchlist) return currentWatchlist;
            return { ...currentWatchlist, nextMovieId: movieId };
          }
        );
      },
      onSettled: () =>
        queryClient.invalidateQueries({ queryKey: ["watchlist", clubId] }),
    }
  );
}

export function useDeleteBacklogItem(clubId: string) {
  const { authToken } = useAuthStore();
  const queryClient = useQueryClient();
  return useMutation(
    (movieId: number) =>
      axios.delete(`/api/club/${clubId}/backlog/${movieId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      }),
    {
      onMutate: async (movieId) => {
        await queryClient.cancelQueries(["watchlist", clubId]);
        queryClient.setQueryData<WatchListViewModel>(
          ["watchlist", clubId],
          (currentWatchlist) => {
            if (!currentWatchlist) return currentWatchlist;
            return {
              ...currentWatchlist,
              backlog: currentWatchlist.backlog.filter(
                (item) => item.movieId !== movieId
              ),
            };
          }
        );
      },
      onSettled: () =>
        queryClient.invalidateQueries({ queryKey: ["watchlist", clubId] }),
    }
  );
}

export function useAddBacklogItem(clubId: string) {
  const { authToken } = useAuthStore();
  const queryClient = useQueryClient();
  return useMutation(
    (movieId: number) =>
      axios.post(`/api/club/${clubId}/backlog/${movieId}`, undefined, {
        headers: { Authorization: `Bearer ${authToken}` },
      }),
    {
      onSuccess: (response) => {
        queryClient.setQueryData<WatchListViewModel>(
          ["watchlist", clubId],
          (currentWatchlist) => {
            if (!currentWatchlist) return currentWatchlist;
            return {
              ...currentWatchlist,
              backlog: [...currentWatchlist.backlog, response.data],
            };
          }
        );
      },
      onSettled: () =>
        queryClient.invalidateQueries({ queryKey: ["watchlist", clubId] }),
    }
  );
}
