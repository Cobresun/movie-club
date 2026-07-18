import { isDefined } from "../../../lib/checks/checks";
import { WorkType } from "../../../lib/types/generated/db";
import type { DiaryEntry } from "../../../lib/types/me";

/**
 * A work in the library's Works view — the derived rollup of every diary event
 * for one work. "Your score" is the latest event's score (never stored).
 */
export interface LibraryWork {
  /** Stable grouping key: `type:externalId` (falls back to the work id). */
  key: string;
  title: string;
  type: WorkType;
  externalId: string | null;
  imageUrl: string | null;
  /** Latest event's score, or null when the latest event was unrated. */
  latestScore: number | null;
  /** How many diary events reference this work (rewatches included). */
  eventCount: number;
}

/**
 * Group a diary stream into works by (type, externalId), client-side — there is
 * no /api/me/works endpoint in M1. Entries arrive newest-first, so the first
 * event seen for a work is its latest, and its score is the derived rollup.
 */
export function groupWorks(entries: DiaryEntry[]): LibraryWork[] {
  const groups = new Map<string, LibraryWork>();
  for (const entry of entries) {
    const { work } = entry;
    const key = `${work.type}:${work.externalId ?? work.id}`;
    const existing = groups.get(key);
    if (isDefined(existing)) {
      existing.eventCount += 1;
      continue;
    }
    groups.set(key, {
      key,
      title: work.title,
      type: work.type,
      externalId: work.externalId,
      imageUrl: work.imageUrl,
      latestScore: entry.score,
      eventCount: 1,
    });
  }
  return [...groups.values()];
}
