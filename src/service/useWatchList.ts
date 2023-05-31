import {
  useMutation,
  useQuery,
  useQueryClient,
  UseQueryReturnType,
} from "@tanstack/vue-query";
import axios, { AxiosError } from "axios";

import { WatchListItem, WatchListViewModel } from "@/common/types/models";
import { useAuthStore } from "@/stores/auth";

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
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (movie: WatchListItem) =>
      auth.request.post(`/api/club/${clubId}/watchList/${movie.movieId}`),
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
  });
}

export function useDeleteMovie(clubId: string) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (movieId: number) =>
      auth.request.delete(`/api/club/${clubId}/watchList/${movieId}`),
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
  });
}

export function useMakeNextWatch(clubId: string) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (movieId: number) =>
      auth.request.put(`/api/club/${clubId}/nextMovie`, {
        nextMovieId: movieId,
      }),
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
  });
}

export function useDeleteBacklogItem(clubId: string) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (movieId: number) =>
      auth.request.delete(`/api/club/${clubId}/backlog/${movieId}`),
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
  });
}

export function useAddBacklogItem(clubId: string) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (movieId: number) =>
      auth.request.post(`/api/club/${clubId}/backlog/${movieId}`),
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
  });
}
