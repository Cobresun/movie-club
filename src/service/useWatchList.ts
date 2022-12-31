import { computed, watch } from "vue";

import { useAuthRequest, useRequestCache } from "./useRequest";

import { CacheDataService, WatchListItem, WatchListViewModel } from "@/common/types/models";
import { useWatchListStore } from "@/stores/watchList";

export function useWatchList(
  clubId: string
): CacheDataService<WatchListViewModel> {
  const store = useWatchListStore();
  const fetch = useRequestCache<WatchListViewModel>(
    `watchlist-${clubId}`,
    `/api/club/${clubId}/watchList`
  );
  watch(fetch.data, (newValue) => {
    if (newValue) {
      store.addClub(clubId, newValue);
    }
  });
  const data = computed(() => store.getWatchList(clubId));

  return { ...fetch, data };
}

export function useAddMovie(clubId: string) {
  const store = useWatchListStore();
  const request = useAuthRequest<WatchListItem>();
  const addMovie = async (movieId: number) => {
    await request.execute(`/api/club/${clubId}/watchList/${movieId}`, {
      method: "POST",
    });
    if (request.data.value) {
      store.addMovie(clubId, request.data.value);
    }
  };
  return { ...request, addMovie };
}

export function useDeleteMovie(clubId: string) {
  const store = useWatchListStore();
  const deleteRequest = useAuthRequest();
  const deleteMovie = async (movieId: number) => {
    await deleteRequest.execute(`/api/club/${clubId}/watchList/${movieId}`, {
      method: "DELETE",
    });
    if (!deleteRequest.error.value) {
      store.deleteMovie(clubId, movieId);
    }
  };
  return { ...deleteRequest, deleteMovie };
}

export function useMakeNextWatch(clubId: string) {
  const store = useWatchListStore();
  const request = useAuthRequest();
  const makeNextWatch = async (movieId: number) => {
    await request.execute(`/api/club/${clubId}/nextMovie`, {
      data: {
        nextMovieId: movieId,
      },
      method: "PUT",
    });
    if (request.response.value) {
      store.nextMovie(clubId, movieId);
    }
  };
  return { ...request, makeNextWatch };
}

export function useDeleteBacklogItem(clubId: string) {
  const store = useWatchListStore();
  const request = useAuthRequest();
  const deleteBacklogItem = async (movieId: number) => {
    await request.execute(`/api/club/${clubId}/backlog/${movieId}`, {
      method: "DELETE",
    });
    if (request.response.value) {
      store.deleteBacklogItem(clubId, movieId);
    }
  };
  return { ...request, deleteBacklogItem };
}

export function useAddBacklogItem(clubId: string) {
  const store = useWatchListStore();
  const request = useAuthRequest<WatchListItem>();
  const addBacklogItem = async (movieId: number) => {
    await request.execute(`/api/club/${clubId}/backlog/${movieId}`, {
      method: "POST",
    });
    if (request.data.value) {
      store.addBacklogItem(clubId, request.data.value);
    }
  };
  return { ...request, addBacklogItem };
}
