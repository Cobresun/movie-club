import { useQuery } from "@tanstack/vue-query";
import { computed, type MaybeRefOrGetter, type Ref, toValue } from "vue";

import { hasValue, isDefined } from "../../lib/checks/checks.js";
import { type TMDBWatchProvidersResponse } from "../../lib/types/tmdb";
import { type TMDBTvSeasonData } from "../../lib/types/tv";
import { http } from "@/common/http";

const key = import.meta.env.VITE_TMDB_API_KEY;

/**
 * Every episode TMDB lists for one season of a show. The reviews list only
 * carries episodes the club has scored; this is what lets a member see the
 * rest and score one once they have watched it.
 */
export function useTvSeason(
  showId: Ref<string | undefined>,
  seasonNumber: Ref<number | undefined>,
) {
  return useQuery<TMDBTvSeasonData>({
    queryKey: ["tmdb", "tv-season", showId, seasonNumber],
    enabled: computed(() => hasValue(showId.value) && isDefined(seasonNumber.value)),
    // An airing season gains episodes week to week, so this is not per-id
    // immutable data; an hour matches the watch-providers window.
    staleTime: 1000 * 60 * 60,
    queryFn: async ({ signal }) =>
      (
        await http.get<TMDBTvSeasonData>(
          `https://api.themoviedb.org/3/tv/${showId.value}/season/${seasonNumber.value}?api_key=${key}&language=en-US`,
          { signal },
        )
      ).data,
  });
}

/**
 * Where a work streams, by region. `tmdbPath` is the TMDB resource the club
 * type registry names for it ("movie/27205", "tv/95396").
 */
export function useWatchProviders(tmdbPath: MaybeRefOrGetter<string | undefined>) {
  return useQuery<TMDBWatchProvidersResponse>({
    queryKey: computed(() => ["tmdb", "watch-providers", toValue(tmdbPath)]),
    enabled: computed(() => hasValue(toValue(tmdbPath))),
    // Providers change slowly; an hour-long stale window keeps the data far
    // fresher than the daily-refreshed copy stored for other work metadata.
    staleTime: 1000 * 60 * 60,
    queryFn: async ({ signal }) =>
      (
        await http.get<TMDBWatchProvidersResponse>(
          `https://api.themoviedb.org/3/${toValue(tmdbPath)}/watch/providers?api_key=${key}`,
          { signal },
        )
      ).data,
  });
}
