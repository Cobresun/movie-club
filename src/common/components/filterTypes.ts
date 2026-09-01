// Shared types for the search-filter UI (SearchFilterBar + FilterPanelContent).
// Kept in a plain .ts module so both vue-tsc and typescript-eslint resolve them
// (types exported from a .vue <script> block are not seen by the ESLint type service).

export type Comparator = ">" | "=" | "<";

/** Inclusive span of calendar years, the value a `year` filter applies. */
export interface YearRange {
  from: number;
  to: number;
}

export interface FilterOption {
  key: string;
  label: string;
  type: "string" | "number" | "date" | "enum" | "year";
  placeholder?: string;
}
