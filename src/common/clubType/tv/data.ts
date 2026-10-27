import { WorkDataSummary } from "@/../lib/types/lists";
import { TvDataSummary } from "@/../lib/types/tv";

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

/** The year a show first aired, or an episode aired. */
export function tvAirYear(tv: TvDataSummary): number | undefined {
  const year = tv.airDate !== undefined ? Number.parseInt(tv.airDate.slice(0, 4), 10) : Number.NaN;
  return Number.isFinite(year) ? year : undefined;
}
