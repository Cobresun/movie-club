import { hasValue } from "@/../lib/checks/checks";
import { DetailedBookData } from "@/../lib/types/book";
import { DetailedWorkData } from "@/../lib/types/lists";
import { DetailedMovieData } from "@/../lib/types/movie";

// Movies cache only a bare TMDB poster path; expand it here (w500 — higher res
// than the w154 url stored on the work). Books store an absolute cover url.
const TMDB_POSTER_BASE = "https://image.tmdb.org/t/p/w500";

/** Type guard: `externalData` is movie metadata. */
export function isMovieData(
  data: DetailedWorkData | undefined,
): data is DetailedMovieData {
  return data?.kind === "movie";
}

/** Type guard: `externalData` is book metadata. */
export function isBookData(
  data: DetailedWorkData | undefined,
): data is DetailedBookData {
  return data?.kind === "book";
}

/**
 * Narrow a {@link DetailedWorkData} union to its movie/book member. Returns
 * undefined when the data is absent or of a different kind, so callers can
 * drive `v-if`-gated, type-specific UI off the result.
 */
export function asMovie(
  data: DetailedWorkData | undefined,
): DetailedMovieData | undefined {
  return isMovieData(data) ? data : undefined;
}

export function asBook(
  data: DetailedWorkData | undefined,
): DetailedBookData | undefined {
  return isBookData(data) ? data : undefined;
}

/**
 * Resolve a ready-to-render poster/cover URL for a work. Prefers the movie's
 * TMDB poster path (rendered at a higher resolution than the stored url),
 * otherwise falls back to the work's own `imageUrl` (a book cover, or a movie
 * whose details haven't been cached yet).
 */
export function workPosterUrl(
  data: DetailedWorkData | undefined,
  fallbackImageUrl?: string | null,
): string | undefined {
  const movie = asMovie(data);
  if (hasValue(movie?.poster_path)) {
    return `${TMDB_POSTER_BASE}${movie.poster_path}`;
  }
  return fallbackImageUrl ?? undefined;
}

/** "155" minutes → "2h 35m" (or "45m" under an hour). */
export function formatRuntime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}
