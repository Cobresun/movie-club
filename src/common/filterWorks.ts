import { hasValue } from "@/../lib/checks/checks";
import { ClubType } from "@/../lib/types/generated/db";
import { DetailedWorkListItem } from "@/../lib/types/lists";
import { clubTypeConfig } from "@/common/clubType";
import { FilterQuery, includesCaseInsensitive } from "@/common/filterMatchers";

/**
 * Filters work/review rows down to those matching every applied structured
 * filter plus the optional free-text title search.
 *
 * Which filters exist — and how each one matches — is defined entirely by the
 * club type's `filterOptions` registry (see `clubType.ts`). This function is
 * media-agnostic: it walks that registry and delegates to each applied
 * option's `matches` predicate, so it never grows a branch when a new club
 * type or field is added.
 *
 * @param works - The rows to filter.
 * @param searchQuery.filters - Map of filter key to `{ operator?, value }`.
 * @param searchQuery.freeText - Free text matched against the row title.
 * @param clubType - Selects which `filterOptions` apply.
 *
 * Numeric and date filters honour the comparison operators `>`, `<`, and `=`
 * (defaulting to `=` when none is given). Multiple filters implicitly AND
 * together.
 *
 * TODO: Add support for OR searches.
 */
export function filterWorks<T extends DetailedWorkListItem>(
  works: T[],
  searchQuery: {
    filters: Record<string, FilterQuery>;
    freeText: string;
  },
  clubType: ClubType,
): T[] {
  const { filters, freeText } = searchQuery;
  let result = [...works];

  for (const option of clubTypeConfig(clubType).filterOptions) {
    const query = filters[option.key];
    if (query === undefined || !hasValue(query.value)) continue;
    result = result.filter((work) => option.matches(work, query));
  }

  if (hasValue(freeText)) {
    result = result.filter((work) => includesCaseInsensitive(work.title, freeText));
  }

  return result;
}
