import { useQuery } from "@tanstack/vue-query";
import axios from "axios";
import { computed, MaybeRef, unref } from "vue";

import { SiteMetrics, SnapshotHistoryPoint } from "../../lib/types/metrics";

/** Default window for the snapshot history charts, in days. */
export const DEFAULT_HISTORY_DAYS = 90;

export function useAdminMetrics() {
  return useQuery<SiteMetrics>({
    queryKey: ["admin", "metrics"],
    queryFn: async () => (await axios.get<SiteMetrics>("/api/admin/metrics")).data,
    // A 401 here means "you are not a site admin", which no amount of retrying
    // will fix — retries would just delay the unauthorized state by seconds.
    retry: false,
  });
}

/**
 * Snapshot history over a window the caller can change.
 *
 * `days` is a `MaybeRef` so the dashboard's window toggle drives it directly:
 * the key includes the value, so switching windows swaps to a separately cached
 * entry and flipping back is instant rather than a refetch.
 */
export function useAdminMetricsHistory(days: MaybeRef<number> = DEFAULT_HISTORY_DAYS) {
  const window = computed(() => unref(days));

  return useQuery<SnapshotHistoryPoint[]>({
    queryKey: ["admin", "metrics", "history", window],
    queryFn: async () =>
      (await axios.get<SnapshotHistoryPoint[]>(`/api/admin/metrics/history?days=${window.value}`))
        .data,
    retry: false,
  });
}
