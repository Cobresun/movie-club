import { useInfiniteQuery, useQuery } from "@tanstack/vue-query";
import axios from "axios";
import { computed, Ref } from "vue";

import { hasValue } from "../../lib/checks/checks.js";
import {
  TMDBPageResponse,
  TMDBWatchProvidersResponse,
} from "../../lib/types/movie";

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

export function useWatchProviders(externalId: Ref<string | undefined>) {
  return useQuery<TMDBWatchProvidersResponse>({
    queryKey: ["tmdb", "watch-providers", externalId],
    enabled: computed(() => hasValue(externalId.value)),
    // Providers change slowly; an hour-long stale window keeps the data far
    // fresher than the daily-refreshed copy stored for other movie metadata.
    staleTime: 1000 * 60 * 60,
    queryFn: async ({ signal }) =>
      (
        await axios.get<TMDBWatchProvidersResponse>(
          `https://api.themoviedb.org/3/movie/${externalId.value}/watch/providers?api_key=${key}`,
          { signal },
        )
      ).data,
  });
}
