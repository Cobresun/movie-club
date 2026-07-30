import { useQuery } from "@tanstack/vue-query";
import axios from "axios";

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

export function useAdminMetricsHistory(days: number = DEFAULT_HISTORY_DAYS) {
  return useQuery<SnapshotHistoryPoint[]>({
    queryKey: ["admin", "metrics", "history", days],
    queryFn: async () =>
      (await axios.get<SnapshotHistoryPoint[]>(`/api/admin/metrics/history?days=${days}`)).data,
    retry: false,
  });
}
