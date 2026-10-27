import axios from "axios";

import type { BrowsePage, WorkSearchResult } from "../types";
import { hasValue } from "@/../lib/checks/checks";
import { secureImageUrl, sortVolumesByPopularity } from "@/../lib/googleBooks";
import { GoogleBooksSearchResponse, GoogleBooksVolume } from "@/../lib/types/book";

const GOOGLE_BOOKS_KEY = import.meta.env.VITE_GOOGLE_BOOKS_API_KEY;
const GOOGLE_BOOKS_BASE_URL = "https://www.googleapis.com/books/v1";

/** Map a Google Books volume (search or browse) to a WorkSearchResult. */
function volumeToResult(volume: GoogleBooksVolume): WorkSearchResult {
  const info = volume.volumeInfo;
  const thumbnail = info?.imageLinks?.thumbnail ?? info?.imageLinks?.smallThumbnail;
  return {
    externalId: volume.id,
    title: info?.title ?? "Untitled",
    subtitle:
      [info?.authors?.[0], info?.publishedDate?.slice(0, 4)].filter(hasValue).join(" · ") ||
      undefined,
    imageUrl: hasValue(thumbnail) ? secureImageUrl(thumbnail) : undefined,
  };
}

/**
 * Query Google Books volumes and map to WorkSearchResults. `sortVolumes` runs
 * on the raw volumes, before mapping discards fields like `ratingsCount`.
 */
async function fetchBookVolumes(
  params: Record<string, string>,
  signal?: AbortSignal,
  sortVolumes?: (volumes: GoogleBooksVolume[]) => GoogleBooksVolume[],
): Promise<WorkSearchResult[]> {
  const searchParams = new URLSearchParams({
    printType: "books",
    // Keyless requests work at low rate limits; an empty key param is a 400.
    ...(hasValue(GOOGLE_BOOKS_KEY) ? { key: GOOGLE_BOOKS_KEY } : {}),
    ...params,
  });
  const { data } = await axios.get<GoogleBooksSearchResponse>(
    `${GOOGLE_BOOKS_BASE_URL}/volumes?${searchParams.toString()}`,
    { signal },
  );
  const volumes = data.items ?? [];
  return (sortVolumes ? sortVolumes(volumes) : volumes).map(volumeToResult);
}

export async function searchBooks(
  query: string,
  signal?: AbortSignal,
): Promise<WorkSearchResult[]> {
  return fetchBookVolumes({ q: query, maxResults: "20" }, signal, sortVolumesByPopularity);
}

/**
 * Newest Google Books volumes for a subject. Google Books has no trending
 * endpoint, so each book browse tab is a subject query, and it is one page.
 */
export async function browseBooks(
  subject: string,
  _page: number,
  signal?: AbortSignal,
): Promise<BrowsePage> {
  const results = await fetchBookVolumes(
    {
      q: `subject:"${subject}"`,
      orderBy: "newest",
      maxResults: "24",
      langRestrict: "en",
    },
    signal,
  );
  // newest-first surfaces many coverless volumes; a coverless grid looks
  // broken, so only show results with an image.
  return { results: results.filter((result) => hasValue(result.imageUrl)) };
}
