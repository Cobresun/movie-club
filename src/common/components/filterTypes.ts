// Shared types for the search-filter UI (SearchFilterBar + FilterPanelContent).
// Kept in a plain .ts module so both vue-tsc and typescript-eslint resolve them
// (types exported from a .vue <script> block are not seen by the ESLint type service).

export type Comparator = ">" | "=" | "<";

/** Inclusive span of calendar years, the value a `year` filter applies. */
export interface YearRange {
  from: number;
  to: number;
}

/**
 * The shapes of filter a club type may offer, each with its own form in
 * FilterPanelContent. Declared once here and reused by the registry's
 * FilterOption and by the applied-filter pills, so a new type can't be added to
 * one and forgotten in the others.
 */
export type FilterOptionType = "number" | "date" | "enum" | "year";

export interface FilterOption {
  key: string;
  label: string;
  type: FilterOptionType;
  placeholder?: string;
}
