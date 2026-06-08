import { WorkType } from "../../../../lib/types/generated/db";
import { DetailedWorkData } from "../../../../lib/types/lists";

/** Outcome of one provider's stale-details refresh batch. */
export interface RefreshResult {
  processed: number;
  updated: number;
  errors: { externalId: string; error: string }[];
}

/**
 * A MediaProvider owns everything specific to one kind of work: where its
 * metadata comes from (TMDB, OpenLibrary, …) and how that cached metadata is
 * read back as the unified {@link DetailedWorkData} shape.
 *
 * Adding a new club type = implement one provider + register it in `index.ts`.
 * The review/list/club core never references a provider concretely; it always
 * dispatches through `getProvider(type)`.
 */
export interface MediaProvider {
  readonly type: WorkType;

  /**
   * Fetch external metadata for a freshly-added work and cache it in this
   * provider's detail tables. Implementations should be safe to call when the
   * work's details already exist (upsert / do-nothing semantics).
   */
  fetchAndCacheDetails: (externalId: string) => Promise<void>;

  /**
   * Look up cached metadata for a set of external IDs, keyed by external ID.
   * Missing entries simply mean "not cached yet" — callers treat absence as
   * `externalData: undefined`, never an error.
   */
  getExternalData: (
    externalIds: string[],
  ) => Promise<Map<string, DetailedWorkData>>;

  /**
   * Re-fetch the `limit` works whose cached details are stalest (oldest
   * `updated_date` first) and overwrite them with fresh external data, bumping
   * `updated_date`. Driven by the scheduled refresh cron; per-work failures are
   * collected rather than thrown so one bad id doesn't abort the batch.
   */
  refreshStaleDetails: (limit: number) => Promise<RefreshResult>;
}
