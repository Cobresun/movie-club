import { DataService, TMDBPageResponse } from "@/models";
import axios, { CancelTokenSource } from "axios";
import { computed, ref } from "vue";
import { useRequest, useRequestCache } from "./useRequest";

const key = import.meta.env.VITE_TMDB_API_KEY;

interface SearchDataService<T> extends DataService<T> {
  search: (query: string) => Promise<void>;
}

export function useSearch(): SearchDataService<TMDBPageResponse> {
  const request = useRequest<TMDBPageResponse>();
  const cancelToken = ref<CancelTokenSource>();
  const emptySearch = ref(false);
  const search = async (query: string) => {
    if (cancelToken.value) {
      cancelToken.value.cancel();
    }
    if (query === "") {
      emptySearch.value = true;
      return;
    }
    cancelToken.value = axios.CancelToken.source();
    await request.execute(
      `https://api.themoviedb.org/3/search/movie?api_key=${key}&query=${query}&language=en-US&include_adult=false`,
      {
        cancelToken: cancelToken.value?.token,
      }
    );
  };
  const emptyData = computed<TMDBPageResponse>(() => ({
    page: 0,
    total_pages: 0,
    total_results: 0,
    results: [],
  }));
  return {
    ...request,
    data: emptySearch.value ? emptyData : request.data,
    search,
  };
}

export function useTrending(): DataService<TMDBPageResponse> {
  const request = useRequestCache<TMDBPageResponse>(
    "TMDB-trending",
    `https://api.themoviedb.org/3/trending/movie/week?api_key=${key}`
  );
  return { ...request };
}
