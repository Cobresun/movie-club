import { useQuery } from "@tanstack/vue-query";
import axios from "axios";
import { Ref } from "vue";

import { TMDBPageResponse } from "@/common/types/movie";

const key = import.meta.env.VITE_TMDB_API_KEY;

export function useSearch(query: Ref<string>, enabled: boolean) {
  return useQuery<TMDBPageResponse>({
    queryKey: ["tmdb", "search", query],
    enabled,
    queryFn: async ({ signal }) =>
      (
        await axios.get(
          `https://api.themoviedb.org/3/search/movie?api_key=${key}&query=${query.value}&language=en-US&include_adult=false`,
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
        await axios.get(
          `https://api.themoviedb.org/3/trending/movie/week?api_key=${key}`,
        )
      ).data,
  });
}
