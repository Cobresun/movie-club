import { isDefined } from "../../../lib/checks/checks";
import { WorkType } from "../../../lib/types/generated/db";
import type { DiaryWatch } from "../../../lib/types/me";

/**
 * A work in the library gallery — the derived rollup of every watch of one
 * work. "Your score" is the latest watch's canonical score (never stored).
 */
export interface LibraryWork {
  /** Stable grouping key: `type:externalId` (falls back to the work id). */
  key: string;
  title: string;
  type: WorkType;
  externalId: string | null;
  imageUrl: string | null;
  /** Latest watch's score, or null when the latest watch is unrated. */
  latestScore: number | null;
  /** Every watch of this work, newest-first (rewatches included). */
  watches: DiaryWatch[];
}

/**
 * Group the diary stream into works by (type, externalId), client-side — there
 * is no /api/me/works endpoint in M1. Watches arrive newest-first, so the first
 * watch seen for a work is its latest, and insertion order doubles as the
 * gallery sort: works ordered by date of last watch, descending.
 */
export function groupWorks(watches: DiaryWatch[]): LibraryWork[] {
  const groups = new Map<string, LibraryWork>();
  for (const watch of watches) {
    const { work } = watch;
    const key = `${work.type}:${work.externalId ?? work.id}`;
    const existing = groups.get(key);
    if (isDefined(existing)) {
      existing.watches.push(watch);
      continue;
    }
    groups.set(key, {
      key,
      title: work.title,
      type: work.type,
      externalId: work.externalId,
      imageUrl: work.imageUrl,
      latestScore: watch.score,
      watches: [watch],
    });
  }
  return [...groups.values()];
}
