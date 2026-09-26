import { DetailedReviewListItem, DetailedWorkListItem, Review } from "@/../lib/types/lists";
import type { FilterOption } from "@/common/clubType";
import type {
  ChoiceSelection,
  FilterSelection,
  RangeSelection,
} from "@/common/components/filterTypes";

export function includesCaseInsensitive(haystack?: string, needle?: string): boolean {
  return haystack?.toLowerCase().includes(needle?.toLowerCase() ?? "") ?? false;
}

/** Picking several values from one filter widens it: any of them will do. */
function choiceIncludes(values: string[], selection: ChoiceSelection): boolean {
  return values.some((value) => selection.values.includes(value));
}

/** A work with no value for a range filter never matches an active one. */
export function rangeIncludes(value: number | undefined, selection: RangeSelection): boolean {
  if (value === undefined) return false;
  return (
    (selection.from === undefined || value >= selection.from) &&
    (selection.to === undefined || value <= selection.to)
  );
}

export function matchesSelection(
  option: FilterOption,
  work: DetailedWorkListItem,
  selection: FilterSelection,
): boolean {
  if (option.kind === "choice") {
    return selection.kind === "choice" && choiceIncludes(option.values(work), selection);
  }
  return selection.kind === "range" && rangeIncludes(option.value(work), selection);
}

/** "1990 – 1999", "8+", "Up to 1h 30m" — how an applied range reads back. */
export function describeRange(selection: RangeSelection, format: (value: number) => string) {
  const { from, to } = selection;
  if (from !== undefined && to !== undefined) {
    return from === to ? format(from) : `${format(from)} – ${format(to)}`;
  }
  if (from !== undefined) return `${format(from)}+`;
  if (to !== undefined) return `Up to ${format(to)}`;
  return "Any";
}

function hasScores(work: DetailedWorkListItem): work is DetailedReviewListItem {
  return "scores" in work;
}

/** Average score for a review row, or undefined for non-review works. */
export function reviewAverageScore(work: DetailedWorkListItem): number | undefined {
  if (!hasScores(work)) return undefined;
  const average: Review | undefined = work.scores.average;
  return average?.score;
}
