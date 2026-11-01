import { hasValue } from "../checks/checks.js";

export function releaseYear(data: { release_date?: string }): number | undefined {
  const year = hasValue(data.release_date)
    ? Number.parseInt(data.release_date.slice(0, 4), 10)
    : Number.NaN;
  return Number.isFinite(year) ? year : undefined;
}
