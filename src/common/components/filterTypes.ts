// Shared types for the search-filter UI (SearchFilterBar, FilterPanel and its
// sections). Kept in a plain .ts module so the registry in clubType.ts can use
// them without importing a .vue file.

/** The values picked from a choice filter; a work matches if it has any of them. */
export interface ChoiceSelection {
  kind: "choice";
  values: string[];
}

/**
 * An inclusive numeric span. A missing end is open, so `{ from: 8 }` reads as
 * "8 and up" and survives the data growing past today's highest value.
 */
export interface RangeSelection {
  kind: "range";
  from?: number;
  to?: number;
}

export type FilterSelection = ChoiceSelection | RangeSelection;

/** A one-tap shortcut for a range filter, e.g. "Short & sweet" → up to 90 minutes. */
export interface RangePreset {
  label: string;
  /** The span in words, when the label alone doesn't say it ("8+"). */
  detail?: string;
  from?: number;
  to?: number;
}
