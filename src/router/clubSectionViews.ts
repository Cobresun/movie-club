import { z } from "zod";

// The router and the prefetch below load a section through the same function,
// so both resolve to the one chunk.
export const loadWatchListView = () => import("../features/watch-list/views/WatchListView.vue");
export const loadStatisticsView = () => import("../features/statistics/views/StatisticsView.vue");

// Not in TypeScript's DOM types: only some browsers implement it.
const connectionSchema = z.object({ saveData: z.boolean().optional() });

function prefersLessData(): boolean {
  const connection = connectionSchema.safeParse(Reflect.get(navigator, "connection"));
  return connection.success && connection.data.saveData === true;
}

/**
 * Downloads the code for the sections every club has, ahead of anyone opening
 * them. A navigation is held until its section's chunk has arrived, so without
 * this the first tap on a tab does nothing visible for as long as the download
 * takes, and Statistics brings the charting library with it.
 *
 * Skipped when the browser has asked sites to save data. A failed download is
 * left for the navigation itself to retry and report.
 */
export function prefetchClubSections(): void {
  if (prefersLessData()) return;
  for (const load of [loadWatchListView, loadStatisticsView]) {
    load().catch(() => undefined);
  }
}
