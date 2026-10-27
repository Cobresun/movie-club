import type { ChoiceFilterOption, RangeFilterOption } from "./types";
import type { RangePreset } from "@/common/components/filterTypes";
import { reviewAverageScore } from "@/common/filterMatchers";

const formatScore = (score: number) => String(Math.round(score * 100) / 100);

function yearOf(isoDate: string): string {
  return isoDate.slice(0, 4);
}

/** "’90s" for last century, "2010s" for this one — the way people say them. */
export function decadePresets(years: number[]): RangePreset[] {
  const decades = [...new Set(years.map((year) => Math.floor(year / 10) * 10))].sort(
    (a, b) => a - b,
  );
  return decades.map((decade) => ({
    label: decade < 2000 ? `’${String(decade).slice(2)}s` : `${decade}s`,
    from: decade,
    to: decade + 9,
  }));
}

// Filters shared by every club type (scores and review metadata).
export const clubScoreFilter: RangeFilterOption = {
  kind: "range",
  key: "average_score",
  label: "Club score",
  icon: "star-outline",
  value: reviewAverageScore,
  step: 0.5,
  bucket: 1,
  format: formatScore,
  presets: () => [
    { label: "Loved it", detail: "8+", from: 8 },
    { label: "Liked it", detail: "6+", from: 6 },
    { label: "Not for us", detail: "5 and under", to: 5 },
  ],
};

export const reviewedInFilter: ChoiceFilterOption = {
  kind: "choice",
  key: "review_date",
  label: "Reviewed in",
  icon: "calendar-check-outline",
  values: (work) => [yearOf(work.createdDate)],
  searchPlaceholder: "Find a year",
  order: "newest",
};
