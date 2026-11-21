import { type WorkDisplay } from "../types";
import { isDefined } from "@/../lib/checks/checks";
import { asMovie, formatRuntime } from "@/common/workDisplay";

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
  // Only the full shape carries the overview.
  overview: (data) => {
    const movie = asMovie(data);
    return isDefined(movie) && "overview" in movie ? movie.overview : undefined;
  },
  actors: (details) => asMovie(details)?.actors,
};
