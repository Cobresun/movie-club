import { useQuery } from "@tanstack/vue-query";
import axios from "axios";
import { Ref } from "vue";

import { OpenLibraryTrendingResponse } from "@/../lib/types/book";
import { ClubType } from "@/../lib/types/generated/db";
import {
  bookDocToResult,
  clubTypeConfig,
  WorkSearchResult,
} from "@/common/clubType";

export type { WorkSearchResult } from "@/common/clubType";

export type BookTrendingPeriod = "daily" | "weekly" | "yearly";

/** Trending books from OpenLibrary — the book-club analog of TMDB collections. */
export function useBookTrending(period: Ref<BookTrendingPeriod>) {
  return useQuery<WorkSearchResult[]>({
    queryKey: ["book-trending", period],
    queryFn: async ({ signal }) => {
      const { data } = await axios.get<OpenLibraryTrendingResponse>(
        `https://openlibrary.org/trending/${period.value}.json?limit=24`,
        { signal },
      );
      return data.works.map(bookDocToResult);
    },
  });
}

/**
 * Search for works to add, dispatching to the right external source via the
 * club type registry. Returns a media-agnostic {@link WorkSearchResult}[].
 */
export function useMediaSearch(
  clubType: ClubType,
  query: Ref<string>,
  enabled: boolean,
) {
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
