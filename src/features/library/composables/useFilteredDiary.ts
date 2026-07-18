import { computed } from "vue";
import { useRoute } from "vue-router";

import { hasValue } from "../../../../lib/checks/checks";
import type { DiaryEntry } from "../../../../lib/types/me";

import { useMyReviews } from "@/service/useLibrary";

/**
 * The diary stream narrowed by the ?type= query param (All / Movies / Books).
 * Reading the filter from the route keeps it shareable and avoids a watch or
 * shared filter state — the library gallery derives its works from this.
 */
export function useFilteredDiary() {
  const route = useRoute();
  const { data, isLoading } = useMyReviews();

  const typeFilter = computed(() => {
    const t = route.query.type;
    return typeof t === "string" ? t : undefined;
  });

  const entries = computed<DiaryEntry[]>(() => {
    const all = data.value ?? [];
    const t = typeFilter.value;
    if (!hasValue(t)) return all;
    return all.filter((entry) => String(entry.work.type) === t);
  });

  return { entries, isLoading };
}
