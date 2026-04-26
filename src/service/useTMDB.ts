import { useInfiniteQuery, useQuery } from "@tanstack/vue-query";
import axios from "axios";
import { Ref } from "vue";

import { TMDBPageResponse } from "../../lib/types/movie";

const key = import.meta.env.VITE_TMDB_API_KEY;

export type TMDBCollection =
  | "popular"
  | "now_playing"
  | "upcoming"
  | "top_rated";

export function useSearch(query: Ref<string>, enabled: boolean) {
  return useQuery<TMDBPageResponse>({
    queryKey: ["tmdb", "search", query],
    enabled,
    queryFn: async ({ signal }) =>
      (
        await axios.get<TMDBPageResponse>(
          `https://api.themoviedb.org/3/search/movie?api_key=${key}&query=${query.value}&language=en-US&include_adult=false`,
          { signal },
        )
      ).data,
  });
}

export function useCollection(collection: Ref<TMDBCollection>) {
  return useQuery<TMDBPageResponse>({
    queryKey: ["tmdb", "collection", collection],
    queryFn: async () =>
      (
        await axios.get<TMDBPageResponse>(
          `https://api.themoviedb.org/3/movie/${collection.value}?api_key=${key}&language=en-US`,
        )
      ).data,
  });
}

export function useInfiniteCollection(collection: Ref<TMDBCollection>) {
  return useInfiniteQuery<TMDBPageResponse>({
    queryKey: ["tmdb", "collection", "infinite", collection],
    queryFn: async ({ pageParam = 1 }) =>
      (
        await axios.get<TMDBPageResponse>(
          `https://api.themoviedb.org/3/movie/${collection.value}?api_key=${key}&language=en-US&page=${pageParam}`,
        )
      ).data,
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.total_pages ? lastPage.page + 1 : undefined,
  });
}
