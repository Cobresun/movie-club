import { hasValue } from "@/../lib/checks/checks";
import {
  DetailedReviewListItem,
  DetailedWorkData,
  DetailedWorkListItem,
  Review,
} from "@/../lib/types/lists";

/** Comparison operator for numeric/date filters. */
export type Comparator = ">" | "<" | "=";

/** A single applied filter: a value plus an optional comparator. */
export interface FilterQuery {
  operator?: Comparator;
  value: string;
}

/**
 * Decides whether one work row satisfies an applied filter. Each
 * {@link import("./clubType").FilterOption} owns its matcher, so all field-level
 * filtering logic lives in the club-type registry rather than in `filterWorks`.
 */
export type WorkMatcher = (
  work: DetailedWorkListItem,
  query: FilterQuery,
) => boolean;

export function satisfiesComparator(
  lhs: number,
  op: Comparator,
  rhs: number,
): boolean {
  if (!isFinite(lhs) || !isFinite(rhs)) return false;
  switch (op) {
    case ">":
      return lhs > rhs;
    case "<":
      return lhs < rhs;
    case "=":
    default:
      return lhs === rhs;
  }
}

export function satisfiesDateComparator(
  lhsDate: string | Date,
  op: Comparator,
  rhsDate: string | Date,
): boolean {
  const lhs = new Date(lhsDate);
  const rhs = new Date(rhsDate);
  if (lhs.getTime() === 0 || rhs.getTime() === 0) return false;
  switch (op) {
    case ">":
      return lhs > rhs;
    case "<":
      return lhs < rhs;
    case "=":
    default:
      return lhs.getTime() === rhs.getTime();
  }
}

export function includesCaseInsensitive(
  haystack?: string,
  needle?: string,
): boolean {
  return haystack?.toLowerCase().includes(needle?.toLowerCase() ?? "") ?? false;
}

/**
 * Enum matcher: matches when any of the work's aggregatable values (e.g. genres,
 * authors) contains the query text. `select` is the same selector an enum
 * {@link import("./clubType").FilterOption} uses for its suggestions.
 */
export function enumMatcher(
  select: (data: DetailedWorkData | undefined) => string[],
): WorkMatcher {
  return (work, query) =>
    select(work.externalData).some((value) =>
      includesCaseInsensitive(value, query.value),
    );
}

/** Numeric matcher honouring the `> = <` operators. */
export function numberMatcher(
  select: (work: DetailedWorkListItem) => number | string | undefined,
): WorkMatcher {
  return (work, query) => {
    const raw = select(work);
    const lhs = typeof raw === "string" ? parseFloat(raw) : Number(raw ?? NaN);
    return satisfiesComparator(
      lhs,
      query.operator ?? "=",
      parseFloat(query.value),
    );
  };
}

/** Date matcher honouring the `> = <` operators. */
export function dateMatcher(
  select: (work: DetailedWorkListItem) => string | undefined,
): WorkMatcher {
  return (work, query) => {
    const lhs = select(work);
    if (!hasValue(lhs)) return false;
    return satisfiesDateComparator(lhs, query.operator ?? "=", query.value);
  };
}

function hasScores(work: DetailedWorkListItem): work is DetailedReviewListItem {
  return "scores" in work;
}

/** Average score for a review row, or undefined for non-review works. */
export function reviewAverageScore(
  work: DetailedWorkListItem,
): number | undefined {
  if (!hasScores(work)) return undefined;
  const average: Review | undefined = work.scores.average;
  return average?.score;
}
