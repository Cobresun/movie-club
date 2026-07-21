import axios from "axios";

import { hasValue } from "../../../../lib/checks/checks.js";
import { GoogleBooksSearchResponse, GoogleBooksVolume } from "../../../../lib/types/book";

const BASE_URL = "https://www.googleapis.com/books/v1";

async function makeGoogleBooksApiCall<T>(path: string, params?: Record<string, string>) {
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
  const searchParams = new URLSearchParams({
    // Keyless requests work at low rate limits; an empty key param is a 400.
    ...(hasValue(apiKey) ? { key: apiKey } : {}),
    ...params,
  });
  return axios.get<T>(`${BASE_URL}${path}?${searchParams.toString()}`);
}

/**
 * Fetch a volume. `volumeId` is the Google Books volume id stored as
 * `work.external_id`, e.g. "zyTCAlFPjgYC".
 */
export async function getGoogleBooksVolume(volumeId: string): Promise<GoogleBooksVolume> {
  const { data } = await makeGoogleBooksApiCall<GoogleBooksVolume>(`/volumes/${volumeId}`);
  return data;
}

/**
 * Search volumes. Used by the books-to-Google data migration to re-match
 * OpenLibrary-keyed works; kept here so all Google Books HTTP lives in one
 * module.
 */
export async function searchGoogleBooksVolumes(
  query: string,
  params?: { orderBy?: "relevance" | "newest"; maxResults?: number },
): Promise<GoogleBooksVolume[]> {
  const { data } = await makeGoogleBooksApiCall<GoogleBooksSearchResponse>("/volumes", {
    q: query,
    printType: "books",
    maxResults: String(params?.maxResults ?? 20),
    orderBy: params?.orderBy ?? "relevance",
  });
  return data.items ?? [];
}
