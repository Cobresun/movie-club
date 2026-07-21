import { useQuery } from "@tanstack/vue-query";
import { Ref } from "vue";

import { hasValue } from "@/../lib/checks/checks";
import { ClubType } from "@/../lib/types/generated/db";
import { clubTypeConfig, fetchBookVolumes, WorkSearchResult } from "@/common/clubType";

export type { WorkSearchResult } from "@/common/clubType";

/**
 * Curated browse tabs for book clubs — the book-club analog of TMDB
 * collections. Google Books has no trending endpoint, so each tab is a
 * newest-first subject query.
 */
export const BOOK_BROWSE_SUBJECTS = [
  { key: "fiction", label: "Fiction" },
  { key: "mystery", label: "Mystery" },
  { key: "science fiction", label: "Sci-Fi" },
  { key: "biography", label: "Biography" },
  { key: "history", label: "History" },
] as const;

export type BookBrowseSubject = (typeof BOOK_BROWSE_SUBJECTS)[number]["key"];

/** Newest Google Books volumes for a browse subject. */
export function useBookBrowse(subject: Ref<BookBrowseSubject>) {
  return useQuery<WorkSearchResult[]>({
    queryKey: ["book-browse", subject],
    queryFn: async ({ signal }) => {
      const results = await fetchBookVolumes(
        {
          q: `subject:"${subject.value}"`,
          orderBy: "newest",
          maxResults: "24",
          langRestrict: "en",
        },
        signal,
      );
      // newest-first surfaces many coverless volumes; a coverless grid looks
      // broken, so only show results with an image.
      return results.filter((result) => hasValue(result.imageUrl));
    },
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
