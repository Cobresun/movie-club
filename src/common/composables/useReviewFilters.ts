import { computed, reactive } from "vue";

export interface ReviewFilters {
  genres: string[];
  companies: string[];
  releaseYearRange: { start?: number; end?: number };
  reviewedInYear?: number;
}

export interface ReviewFilterChipData {
  key: keyof ReviewFilters;
  label: string;
  value: string;
}

const createDefaultFilters = (): ReviewFilters => ({
  genres: [],
  companies: [],
  releaseYearRange: {},
  reviewedInYear: undefined,
});

export function useReviewFilters() {
  const filters = reactive<ReviewFilters>(createDefaultFilters());

  const hasActiveFilters = computed(() => {
    return (
      filters.genres.length > 0 ||
      filters.companies.length > 0 ||
      filters.releaseYearRange.start !== undefined ||
      filters.releaseYearRange.end !== undefined ||
      filters.reviewedInYear !== undefined
    );
  });

  const activeFilterCount = computed(() => {
    let count = 0;
    if (filters.genres.length > 0) count++;
    if (filters.companies.length > 0) count++;
    if (
      filters.releaseYearRange.start !== undefined ||
      filters.releaseYearRange.end !== undefined
    )
      count++;
    if (filters.reviewedInYear !== undefined) count++;
    return count;
  });

  const activeFilterChips = computed<ReviewFilterChipData[]>(() => {
    const chips: ReviewFilterChipData[] = [];

    if (filters.genres.length > 0) {
      chips.push({
        key: "genres",
        label: "Genre",
        value:
          filters.genres.length === 1
            ? filters.genres[0]
            : `${filters.genres.length} selected`,
      });
    }

    if (filters.companies.length > 0) {
      chips.push({
        key: "companies",
        label: "Company",
        value:
          filters.companies.length === 1
            ? filters.companies[0]
            : `${filters.companies.length} selected`,
      });
    }

    if (
      filters.releaseYearRange.start !== undefined ||
      filters.releaseYearRange.end !== undefined
    ) {
      let value: string;
      if (
        filters.releaseYearRange.start !== undefined &&
        filters.releaseYearRange.end !== undefined
      ) {
        value = `${filters.releaseYearRange.start}-${filters.releaseYearRange.end}`;
      } else if (filters.releaseYearRange.start !== undefined) {
        value = `${filters.releaseYearRange.start}+`;
      } else {
        value = `Before ${filters.releaseYearRange.end}`;
      }
      chips.push({
        key: "releaseYearRange",
        label: "Release Year",
        value,
      });
    }

    if (filters.reviewedInYear !== undefined) {
      chips.push({
        key: "reviewedInYear",
        label: "Reviewed In",
        value: filters.reviewedInYear.toString(),
      });
    }

    return chips;
  });

  const clearFilter = (key: keyof ReviewFilters) => {
    switch (key) {
      case "genres":
        filters.genres = [];
        break;
      case "companies":
        filters.companies = [];
        break;
      case "releaseYearRange":
        filters.releaseYearRange = {};
        break;
      case "reviewedInYear":
        filters.reviewedInYear = undefined;
        break;
    }
  };

  const clearAllFilters = () => {
    Object.assign(filters, createDefaultFilters());
  };

  const applyFilters = (newFilters: ReviewFilters) => {
    filters.genres = [...newFilters.genres];
    filters.companies = [...newFilters.companies];
    filters.releaseYearRange = { ...newFilters.releaseYearRange };
    filters.reviewedInYear = newFilters.reviewedInYear;
  };

  return {
    filters,
    hasActiveFilters,
    activeFilterCount,
    activeFilterChips,
    clearFilter,
    clearAllFilters,
    applyFilters,
  };
}
