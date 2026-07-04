import type { InjectionKey } from "vue";

/**
 * Opens the work-details drawer for the given work and focuses its score
 * entry field. Provided by GalleryView so that the small poster-chip score
 * affordances can defer score entry to the roomier drawer instead of opening a
 * cramped inline input on the poster.
 */
export type RequestScoreEntry = (workId: string) => void;

export const RequestScoreEntryKey: InjectionKey<RequestScoreEntry> =
  Symbol("requestScoreEntry");
