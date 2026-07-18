import { WorkType } from "./generated/db";

/**
 * Context a diary entry (review event) belongs to. Solo events live on the
 * user's own lists; club events are the user's club review rows, surfaced
 * read-through in the diary (same rows — never copies).
 */
export type DiaryContext =
  | { kind: "solo" }
  | { kind: "club"; clubId: string; clubName: string; clubSlug: string };

export interface DiaryWork {
  id: string;
  title: string;
  type: WorkType;
  externalId: string | null;
  imageUrl: string | null;
}

/**
 * One review event in the user's diary, across every context. Returned by
 * `GET /api/me/reviews`, ordered by COALESCE(watchedDate, createdDate) desc.
 *
 * `text` is the owner's private written review — only ever returned by
 * /api/me endpoints to the session user, never through club endpoints.
 */
export interface DiaryEntry {
  reviewId: string;
  work: DiaryWork;
  /** Null = logged without a rating (unrated logs are a real feature). */
  score: number | null;
  /** "YYYY-MM-DD" or null when the user didn't record a watch date. */
  watchedDate: string | null;
  /** ISO timestamp of when the event was logged. */
  createdDate: string;
  rewatch: boolean;
  text: string | null;
  context: DiaryContext;
}

/**
 * A prior event for one work across contexts, minus the (known) work.
 * Returned by `GET /api/me/reviews/for-work?type=&externalId=`.
 */
export type ForWorkEvent = Omit<DiaryEntry, "work">;

/** Body of `POST /api/me/reviews` (log a watch). */
export interface LogWatchRequest {
  work: {
    type: WorkType;
    title: string;
    externalId?: string;
    imageUrl?: string;
  };
  score?: number | null;
  watchedDate?: string;
  rewatch?: boolean;
  text?: string;
}

export interface LogWatchResponse {
  reviewId: string;
}

/** Body of `PUT /api/me/reviews/:reviewId` — patch semantics, solo events only. */
export interface EditSoloReviewRequest {
  score?: number | null;
  watchedDate?: string | null;
  rewatch?: boolean;
  text?: string | null;
}
