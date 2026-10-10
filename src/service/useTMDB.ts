import { useQuery } from "@tanstack/vue-query";
import axios from "axios";
import { computed, Ref } from "vue";

import { hasValue } from "../../lib/checks/checks.js";
import { TMDBWatchProvidersResponse } from "../../lib/types/movie";

const key = import.meta.env.VITE_TMDB_API_KEY;

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
