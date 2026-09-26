import { hasValue } from "@/../lib/checks/checks";
import { ClubType } from "@/../lib/types/generated/db";
import { DetailedWorkListItem } from "@/../lib/types/lists";
import { clubTypeConfig } from "@/common/clubType";
import type { FilterSelection } from "@/common/components/filterTypes";
import { includesCaseInsensitive, matchesSelection } from "@/common/filterMatchers";

/**
 * Filters work/review rows down to those matching every applied filter plus
 * the optional free-text title search.
 *
 * Which filters exist — and what each one reads from a work — is defined by the
 * club type's `filterOptions` registry (see `clubType.ts`), so this function
 * never grows a branch when a new club type or field is added.
 *
 * Filters AND together; the values picked within one choice filter OR together,
 * so "Horror" + "Comedy" shows both.
 */
export function filterWorks<T extends DetailedWorkListItem>(
  works: T[],
  searchQuery: {
    selections: Partial<Record<string, FilterSelection>>;
    freeText: string;
  },
  clubType: ClubType,
): T[] {
  const { selections, freeText } = searchQuery;
  let result = [...works];

  for (const option of clubTypeConfig(clubType).filterOptions) {
    const selection = selections[option.key];
    if (selection === undefined) continue;
    result = result.filter((work) => matchesSelection(option, work, selection));
  }

  if (hasValue(freeText)) {
    result = result.filter((work) => includesCaseInsensitive(work.title, freeText));
  }

  return result;
}
