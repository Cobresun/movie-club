import { CacheDataService, WatchListViewModel } from "@/models";
import { computed, watch } from "vue";
import { useStore } from "vuex";
import { useAuthRequest, useRequestCache } from "./useRequest";

export function useWatchList(
  clubId: string
): CacheDataService<WatchListViewModel> {
  const store = useStore();
  const fetch = useRequestCache<WatchListViewModel>(
    `watchlist-${clubId}`,
    `/api/club/${clubId}/watchList`
  );
  watch(fetch.data, (newValue) => {
    if (newValue) {
      store.commit("watchList/addClub", { clubId, watchList: newValue });
    }
  });
  const data = computed(() => store.getters["watchList/getWatchList"](clubId));

  return { ...fetch, data };
}

export function useAddMovie(clubId: string) {
  const store = useStore();
  const request = useAuthRequest();
  const addMovie = async (movieId: number) => {
    await request.execute(`/api/club/${clubId}/watchList/${movieId}`, {
      method: "POST",
    });
    if (request.response.value) {
      store.commit("watchList/addMovie", { clubId, movie: request.data.value });
    }
  };
  return { ...request, addMovie };
}

export function useDeleteMovie(clubId: string) {
  const store = useStore();
  const deleteRequest = useAuthRequest();
  const deleteMovie = async (movieId: number) => {
    await deleteRequest.execute(`/api/club/${clubId}/watchList/${movieId}`, {
      method: "DELETE",
    });
    if (!deleteRequest.error.value) {
      store.commit("watchList/deleteMovie", { clubId, movieId });
    }
  };
  return { ...deleteRequest, deleteMovie };
}

export function useMakeNextWatch(clubId: string) {
  const store = useStore();
  const request = useAuthRequest();
  const makeNextWatch = async (movieId: number) => {
    await request.execute(`/api/club/${clubId}/nextMovie`, {
      data: {
        nextMovieId: movieId,
      },
      method: "PUT",
    });
    if (request.response.value) {
      store.commit("watchList/nextMovie", { clubId, movieId });
    }
  };
  return { ...request, makeNextWatch };
}

export function useDeleteBacklogItem(clubId: string) {
  const store = useStore();
  const request = useAuthRequest();
  const deleteBacklogItem = async (movieId: number) => {
    await request.execute(`/api/club/${clubId}/backlog/${movieId}`, {
      method: "DELETE",
    });
    if (request.response.value) {
      store.commit("watchList/deleteBacklogItem", { clubId, movieId });
    }
  };
  return { ...request, deleteBacklogItem };
}
