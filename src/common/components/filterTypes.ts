// Shared types for the search-filter UI (SearchFilterBar + FilterPanelContent).
// Kept in a plain .ts module so both vue-tsc and typescript-eslint resolve them
// (types exported from a .vue <script> block are not seen by the ESLint type service).

export type Comparator = ">" | "=" | "<";

export interface FilterOption {
  key: string;
  label: string;
  type: "string" | "number" | "date" | "enum";
  placeholder?: string;
}
