import { useQuery } from "@tanstack/vue-query";
import axios from "axios";
import { Ref } from "vue";

import { useRequestCache } from "./useRequest";

import { DataService, TMDBPageResponse } from "@/common/types/models";

const key = import.meta.env.VITE_TMDB_API_KEY;

export function useSearch(query: Ref<string>, enabled: boolean) {
  return useQuery({
    queryKey: ["tmdb", "search", query],
    enabled,
    queryFn: async ({ signal }) =>
      (
        await axios.get(
          `https://api.themoviedb.org/3/search/movie?api_key=${key}&query=${query.value}&language=en-US&include_adult=false`,
          { signal }
        )
      ).data,
  });
}

export function useTrending(): DataService<TMDBPageResponse> {
  const request = useRequestCache<TMDBPageResponse>(
    "TMDB-trending",
    `https://api.themoviedb.org/3/trending/movie/week?api_key=${key}`
  );
  return { ...request };
}
