import { type WorkDataSummary } from "@/../lib/types/lists";
import { type TvDataSummary } from "@/../lib/types/tv";

const TMDB_STILL_BASE = "https://image.tmdb.org/t/p/w300";

/** Type guard: `externalData` is TV metadata. */
export function isTvData<T extends WorkDataSummary>(
  data: T | undefined,
): data is Extract<T, { kind: "tv" }> {
  return data?.kind === "tv";
}

/** Narrow a work-data union to its TV member (see `asMovie`). */
export function asTv<T extends WorkDataSummary>(data: T | undefined): TvDataSummary | undefined {
  return isTvData(data) ? data : undefined;
}

/** A TMDB episode still path → a ready-to-render url. */
export function tmdbStillUrl(stillPath: string): string {
  return `${TMDB_STILL_BASE}${stillPath}`;
}
