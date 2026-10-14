import { useQuery } from "@tanstack/vue-query";
import axios from "axios";
import { computed, MaybeRef, unref } from "vue";

import { AdminDashboard, MetricsRange, SnapshotHistoryPoint } from "../../lib/types/metrics";

/**
 * The dashboard over a time frame the caller can change.
 *
 * The range is part of the key, so switching frames swaps to a separately
 * cached entry and flipping back is instant. `keepPreviousData` holds the old
 * frame on screen while a new one loads, rather than dropping the whole page
 * back to a spinner on every tap.
 */
export function useAdminMetrics(range: MaybeRef<MetricsRange>) {
  const selected = computed(() => unref(range));

  return useQuery<AdminDashboard>({
    queryKey: ["admin", "metrics", selected],
    queryFn: async () =>
      (
        await axios.get<AdminDashboard>("/api/admin/metrics", {
          params: { range: selected.value },
        })
      ).data,
    keepPreviousData: true,
    // A 401 here means "you are not a site admin", which no amount of retrying
    // will fix — retries would just delay the unauthorized state by seconds.
    retry: false,
  });
}

/** The daily snapshots over the same range, for the monthly-actives trend. */
export function useAdminMetricsHistory(range: MaybeRef<MetricsRange>) {
  const selected = computed(() => unref(range));

  return useQuery<SnapshotHistoryPoint[]>({
    queryKey: ["admin", "metrics", "history", selected],
    queryFn: async () =>
      (
        await axios.get<SnapshotHistoryPoint[]>("/api/admin/metrics/history", {
          params: { range: selected.value },
        })
      ).data,
    keepPreviousData: true,
    retry: false,
  });
}
