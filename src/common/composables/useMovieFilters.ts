import { computed, reactive } from "vue";

export interface CompanyFilter {
  id: number;
  name: string;
}

export interface MovieFilters {
  genres: number[];
  companies: CompanyFilter[];
  yearRange: { start?: number; end?: number };
  minRating?: number;
  sortBy:
    | "popularity.desc"
    | "vote_average.desc"
    | "primary_release_date.desc"
    | "primary_release_date.asc";
}

export interface FilterChipData {
  key: string;
  label: string;
  value: string;
}

export type SortOption = MovieFilters["sortBy"];

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "popularity.desc", label: "Most Popular" },
  { value: "vote_average.desc", label: "Highest Rated" },
  { value: "primary_release_date.desc", label: "Newest First" },
  { value: "primary_release_date.asc", label: "Oldest First" },
];

const createDefaultFilters = (): MovieFilters => ({
  genres: [],
  companies: [],
  yearRange: {},
  minRating: undefined,
  sortBy: "popularity.desc",
});

export function useMovieFilters() {
  const filters = reactive<MovieFilters>(createDefaultFilters());

  const hasActiveFilters = computed(() => {
    return (
      filters.genres.length > 0 ||
      filters.companies.length > 0 ||
      filters.yearRange.start !== undefined ||
      filters.yearRange.end !== undefined ||
      filters.minRating !== undefined
    );
  });

  const activeFilterCount = computed(() => {
    let count = 0;
    if (filters.genres.length > 0) count++;
    if (filters.companies.length > 0) count++;
    if (
      filters.yearRange.start !== undefined ||
      filters.yearRange.end !== undefined
    )
      count++;
    if (filters.minRating !== undefined) count++;
    return count;
  });

  const activeFilterChips = computed<FilterChipData[]>(() => {
    const chips: FilterChipData[] = [];

    if (filters.genres.length > 0) {
      chips.push({
        key: "genres",
        label: "Genre",
        value: `${filters.genres.length} selected`,
      });
    }

    if (filters.companies.length > 0) {
      const names = filters.companies.map((c) => c.name);
      chips.push({
        key: "companies",
        label: "Company",
        value: names.length === 1 ? names[0] : `${names.length} selected`,
      });
    }

    if (
      filters.yearRange.start !== undefined ||
      filters.yearRange.end !== undefined
    ) {
      let value: string;
      if (
        filters.yearRange.start !== undefined &&
        filters.yearRange.end !== undefined
      ) {
        value = `${filters.yearRange.start}-${filters.yearRange.end}`;
      } else if (filters.yearRange.start !== undefined) {
        value = `${filters.yearRange.start}+`;
      } else {
        value = `Before ${filters.yearRange.end}`;
      }
      chips.push({
        key: "yearRange",
        label: "Year",
        value,
      });
    }

    if (filters.minRating !== undefined) {
      chips.push({
        key: "minRating",
        label: "Rating",
        value: `${filters.minRating}+`,
      });
    }

    return chips;
  });

  const clearFilter = (key: keyof MovieFilters) => {
    switch (key) {
      case "genres":
        filters.genres = [];
        break;
      case "companies":
        filters.companies = [];
        break;
      case "yearRange":
        filters.yearRange = {};
        break;
      case "minRating":
        filters.minRating = undefined;
        break;
      case "sortBy":
        filters.sortBy = "popularity.desc";
        break;
    }
  };

  const clearAllFilters = () => {
    Object.assign(filters, createDefaultFilters());
  };

  const filtersToDiscoverParams = () => {
    const params: Record<string, string> = {};

    if (filters.genres.length > 0) {
      params.with_genres = filters.genres.join(",");
    }

    if (filters.companies.length > 0) {
      params.with_companies = filters.companies.map((c) => c.id).join("|");
    }

    if (filters.yearRange.start !== undefined) {
      params["primary_release_date.gte"] = `${filters.yearRange.start}-01-01`;
    }

    if (filters.yearRange.end !== undefined) {
      params["primary_release_date.lte"] = `${filters.yearRange.end}-12-31`;
    }

    if (filters.minRating !== undefined) {
      params["vote_average.gte"] = filters.minRating.toString();
    }

    params.sort_by = filters.sortBy;

    return params;
  };

  return {
    filters,
    hasActiveFilters,
    activeFilterCount,
    activeFilterChips,
    clearFilter,
    clearAllFilters,
    filtersToDiscoverParams,
  };
}
