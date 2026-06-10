import axios from "axios";

import {
  OpenLibraryAuthor,
  OpenLibraryEditionsResponse,
  OpenLibraryWork,
} from "../../../../lib/types/book";

const BASE_URL = "https://openlibrary.org";

/** Public cover image URL for an OpenLibrary cover id. */
export function coverUrlFromId(
  coverId: number,
  size: "S" | "M" | "L" = "L",
): string {
  return `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg`;
}

/**
 * Fetch a work document. `workKey` is the bare OpenLibrary Work key stored as
 * `work.external_id`, e.g. "OL45804W".
 */
export async function getOpenLibraryWork(
  workKey: string,
): Promise<OpenLibraryWork> {
  const { data } = await axios.get<OpenLibraryWork>(
    `${BASE_URL}/works/${workKey}.json`,
  );
  return data;
}

/**
 * Resolve an author's display name. `authorKey` is the relative key found on a
 * work's `authors[].author.key`, e.g. "/authors/OL23919A".
 */
export async function getOpenLibraryAuthorName(
  authorKey: string,
): Promise<string | undefined> {
  const { data } = await axios.get<OpenLibraryAuthor>(
    `${BASE_URL}${authorKey}.json`,
  );
  return data.name;
}

/**
 * Fetch a work's editions. Used to derive a first-publish year and a
 * representative page count, neither of which the work document reliably
 * carries.
 */
export async function getOpenLibraryEditions(workKey: string) {
  const { data } = await axios.get<OpenLibraryEditionsResponse>(
    `${BASE_URL}/works/${workKey}/editions.json?limit=50`,
  );
  return data.entries;
}
