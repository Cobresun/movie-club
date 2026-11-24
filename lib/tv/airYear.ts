import { hasValue } from "../checks/checks.js";
import { type TvDataSummary } from "../types/tv";

/** The year a show first aired, or an episode aired. */
export function tvAirYear(tv: Pick<TvDataSummary, "airDate">): number | undefined {
  const year = hasValue(tv.airDate) ? Number.parseInt(tv.airDate.slice(0, 4), 10) : Number.NaN;
  return Number.isFinite(year) ? year : undefined;
}
