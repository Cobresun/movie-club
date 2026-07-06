import { hasValue } from "./checks/checks.js";
import { GoogleBooksImageLinks, GoogleBooksVolume } from "./types/book";

/**
 * Pure helpers for normalizing Google Books volume data, shared by the
 * frontend search/browse code and the backend book provider.
 */

/**
 * `book_details.cover_url` is varchar(255); Google image URLs occasionally
 * exceed it once extra params pile on, so anything longer is dropped rather
 * than risking a failed insert.
 */
const MAX_COVER_URL_LENGTH = 255;

/**
 * Make a Google Books image URL safe to render: force https (the API returns
 * http://) and strip the `edge=curl` page-curl effect param.
 */
export function secureImageUrl(url: string): string {
  const secured = url.replace(/^http:\/\//, "https://");
  return secured
    .replace(/([?&])edge=curl&/, "$1")
    .replace(/[?&]edge=curl$/, "");
}

/** Pick the best available cover image from a volume's imageLinks. */
export function bestCoverUrl(
  imageLinks: GoogleBooksImageLinks | undefined,
): string | undefined {
  const raw =
    imageLinks?.medium ??
    imageLinks?.small ??
    imageLinks?.thumbnail ??
    imageLinks?.smallThumbnail;
  if (!hasValue(raw)) return undefined;
  const url = secureImageUrl(raw);
  return url.length <= MAX_COVER_URL_LENGTH ? url : undefined;
}

/** Extract the year from a Google Books publishedDate ("YYYY[-MM[-DD]]"). */
export function parsePublishedYear(
  publishedDate: string | undefined,
): number | undefined {
  if (!hasValue(publishedDate)) return undefined;
  const match = /^\d{4}/.exec(publishedDate);
  return match ? Number(match[0]) : undefined;
}

const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

/**
 * Strip HTML from a Google Books description. Descriptions are rendered with
 * `{{ }}` interpolation, so any leftover markup would show as literal text.
 * Block/line-break tags become newlines to preserve paragraph structure.
 */
export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]*>/g, "")
    .replace(
      /&(?:amp|lt|gt|quot|#39|apos|nbsp);/g,
      (entity) => HTML_ENTITIES[entity] ?? entity,
    )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Sort volumes most-popular-first using `ratingsCount` (the API has no
 * popularity `orderBy`). The sort is stable, so volumes with equal counts —
 * including the many with none at all — keep Google's relevance order.
 */
export function sortVolumesByPopularity(
  volumes: GoogleBooksVolume[],
): GoogleBooksVolume[] {
  return [...volumes].sort(
    (a, b) =>
      (b.volumeInfo?.ratingsCount ?? 0) - (a.volumeInfo?.ratingsCount ?? 0),
  );
}

/**
 * Flatten BISAC category paths ("Fiction / Thrillers / Suspense") into
 * deduped single terms so subject filter suggestions stay short.
 */
export function splitCategories(categories: string[]): string[] {
  const terms = categories.flatMap((category) =>
    category.split(" / ").map((term) => term.trim()),
  );
  return [...new Set(terms)].filter(hasValue);
}
