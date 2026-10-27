import type { WorkDisplay } from "../types";
import { hasValue } from "@/../lib/checks/checks";
import { asMovie, formatRuntime } from "@/common/workDisplay";

export function releaseYear(data: { release_date?: string }): number | undefined {
  const year = hasValue(data.release_date)
    ? Number.parseInt(data.release_date.slice(0, 4), 10)
    : Number.NaN;
  return Number.isFinite(year) ? year : undefined;
}

export const movieDisplay: WorkDisplay = {
  subtitle: (data) => {
    const movie = asMovie(data);
    return movie?.release_date !== undefined && movie.release_date.length >= 4
      ? movie.release_date.slice(0, 4)
      : undefined;
  },
  metaLine: (data) => {
    const movie = asMovie(data);
    if (movie === undefined) return undefined;
    const parts: string[] = [];
    if (movie.runtime !== undefined && movie.runtime > 0) {
      parts.push(formatRuntime(movie.runtime));
    }
    if (movie.genres !== undefined && movie.genres.length > 0) {
      parts.push(movie.genres.join(", "));
    }
    return parts.length > 0 ? parts.join(" · ") : undefined;
  },
  overview: (data) => asMovie(data)?.overview,
};
