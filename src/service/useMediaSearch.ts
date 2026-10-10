import { useInfiniteQuery, useQuery } from "@tanstack/vue-query";
import { Ref } from "vue";

import { ClubType } from "@/../lib/types/generated/db";
import { BrowsePage, clubTypeConfig, WorkSearchResult } from "@/common/clubType";

export type { WorkSearchResult } from "@/common/clubType";

/**
 * Browse one of a club type's {@link ClubTypeConfig.browseTabs}, a page at a
 * time, from the club type's external source.
 */
export function useBrowse(clubType: Ref<ClubType>, tab: Ref<string>, enabled: Ref<boolean>) {
  return useInfiniteQuery<BrowsePage>({
    queryKey: ["browse", clubType, tab],
    enabled,
    queryFn: ({ pageParam = 1, signal }) =>
      clubTypeConfig(clubType.value).browse(tab.value, Number(pageParam), signal),
    getNextPageParam: (lastPage) => lastPage.nextPage,
  });
}

/**
 * Search for works to add, dispatching to the right external source via the
 * club type registry. Returns a media-agnostic {@link WorkSearchResult}[].
 */
export function useMediaSearch(clubType: ClubType, query: Ref<string>, enabled: boolean) {
  return useQuery<WorkSearchResult[]>({
    queryKey: ["media-search", clubType, query],
    enabled,
    queryFn: async ({ signal }) => {
      const trimmed = query.value.trim();
      if (trimmed.length === 0) return [];
      return clubTypeConfig(clubType).search(trimmed, signal);
    },
  });
}
