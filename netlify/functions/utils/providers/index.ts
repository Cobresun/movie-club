import bookProvider from "./bookProvider";
import movieProvider from "./movieProvider";
import { MediaProvider } from "./types";
import { hasValue } from "../../../../lib/checks/checks.js";
import { WorkType } from "../../../../lib/types/generated/db";
import { DetailedWorkData } from "../../../../lib/types/lists";

/**
 * The provider registry. To support a new club type: add the enum value
 * (migration + codegen), implement a MediaProvider, and register it here. No
 * other part of the review/list/club core needs to change.
 */
const providers: Record<WorkType, MediaProvider> = {
  [WorkType.movie]: movieProvider,
  [WorkType.book]: bookProvider,
};

export function getProvider(type: WorkType): MediaProvider {
  return providers[type];
}

/** Every registered provider — used by the scheduled refresh to sweep all types. */
export function allProviders(): MediaProvider[] {
  return Object.values(providers);
}

/**
 * Enrich a set of works with their cached external metadata, dispatching to the
 * right provider by each work's own {@link WorkType} rather than the club's.
 * Works are grouped by type so one call can span providers; the merged result
 * is keyed by external id (entries with no/absent external id are skipped).
 *
 * A club's works are all one type today, but keying enrichment on the work —
 * not the club — means a mixed-type list would Just Work, and it keeps the
 * generic list/review core from ever needing to know about club types.
 */
export async function getExternalDataForWorks(
  works: { externalId: string | null | undefined; type: WorkType }[],
): Promise<Map<string, DetailedWorkData>> {
  const idsByType = new Map<WorkType, string[]>();
  for (const work of works) {
    if (!hasValue(work.externalId)) continue;
    const ids = idsByType.get(work.type) ?? [];
    ids.push(work.externalId);
    idsByType.set(work.type, ids);
  }

  const merged = new Map<string, DetailedWorkData>();
  await Promise.all(
    Array.from(idsByType, async ([type, ids]) => {
      const data = await getProvider(type).getExternalData(ids);
      for (const [externalId, value] of data) merged.set(externalId, value);
    }),
  );
  return merged;
}

export type { MediaProvider } from "./types";
