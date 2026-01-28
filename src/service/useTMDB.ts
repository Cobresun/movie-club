import { useQuery } from "@tanstack/vue-query";
import axios from "axios";
import { computed, Ref } from "vue";

import {
  TMDBCompanySearchResponse,
  TMDBGenreListResponse,
  TMDBPageResponse,
} from "../../lib/types/movie";

const key = import.meta.env.VITE_TMDB_API_KEY;
const BASE_URL = "https://api.themoviedb.org/3";

export function useSearch(query: Ref<string>, enabled: boolean) {
  return useQuery<TMDBPageResponse>({
    queryKey: ["tmdb", "search", query],
    enabled,
    queryFn: async ({ signal }) =>
      (
        await axios.get<TMDBPageResponse>(
          `${BASE_URL}/search/movie?api_key=${key}&query=${query.value}&language=en-US&include_adult=false`,
          { signal },
        )
      ).data,
  });
}

export function useTrending() {
  return useQuery<TMDBPageResponse>({
    queryKey: ["tmdb", "trending"],
    queryFn: async () =>
      (
        await axios.get<TMDBPageResponse>(
          `${BASE_URL}/trending/movie/week?api_key=${key}`,
        )
      ).data,
  });
}

export function useGenres() {
  return useQuery<TMDBGenreListResponse>({
    queryKey: ["tmdb", "genres"],
    staleTime: 1000 * 60 * 60 * 24, // 24 hours - genres rarely change
    queryFn: async () =>
      (
        await axios.get<TMDBGenreListResponse>(
          `${BASE_URL}/genre/movie/list?api_key=${key}&language=en-US`,
        )
      ).data,
  });
}

export function useCompanySearch(query: Ref<string>) {
  const enabled = computed(() => query.value.trim().length >= 2);

  return useQuery<TMDBCompanySearchResponse>({
    queryKey: ["tmdb", "company", "search", query],
    enabled,
    queryFn: async ({ signal }) =>
      (
        await axios.get<TMDBCompanySearchResponse>(
          `${BASE_URL}/search/company?api_key=${key}&query=${encodeURIComponent(query.value)}`,
          { signal },
        )
      ).data,
  });
}

export function useDiscover(
  params: Ref<Record<string, string>>,
  enabled: Ref<boolean>,
) {
  return useQuery<TMDBPageResponse>({
    queryKey: ["tmdb", "discover", params],
    enabled,
    queryFn: async ({ signal }) => {
      const searchParams = new URLSearchParams({
        api_key: key,
        language: "en-US",
        include_adult: "false",
        ...params.value,
      });
      return (
        await axios.get<TMDBPageResponse>(
          `${BASE_URL}/discover/movie?${searchParams.toString()}`,
          { signal },
        )
      ).data;
    },
  });
}
