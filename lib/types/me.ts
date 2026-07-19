import { WorkType } from "./generated/db";

export interface DiaryWork {
  id: string;
  title: string;
  type: WorkType;
  externalId: string | null;
  imageUrl: string | null;
}

/**
 * A club review event attached to a watch: the same physical viewing reviewed
 * in one club. Carries no score of its own — the parent watch owns the
 * canonical score, so every club shows the same (latest) value.
 */
export interface WatchClubReview {
  reviewId: string;
  clubId: string;
  clubName: string;
  clubSlug: string;
  /** ISO timestamp — when the review was posted (or last re-scored) there. */
  createdDate: string;
}

/**
 * One physical viewing/reading in the user's diary — the parent entity of the
 * library. Returned by `GET /api/me/watches`, ordered by
 * COALESCE(watchedDate, createdDate) desc.
 *
 * `text` is the owner's private written note — only ever returned by /api/me
 * endpoints to the session user, never through club endpoints.
 */
export interface DiaryWatch {
  watchId: string;
  work: DiaryWork;
  /** Null = logged without a rating (unrated logs are a real feature). */
  score: number | null;
  /** "YYYY-MM-DD" or null when the user didn't record a watch date. */
  watchedDate: string | null;
  /** ISO timestamp of when the watch was logged. */
  createdDate: string;
  rewatch: boolean;
  text: string | null;
  /** Club reviews of this watch, oldest-first. Empty = solo-only log. */
  clubReviews: WatchClubReview[];
}

/**
 * A prior watch of one work, minus the (known) work.
 * Returned by `GET /api/me/watches/for-work?type=&externalId=`.
 */
export type ForWorkWatch = Omit<DiaryWatch, "work">;

/** Body of `POST /api/me/watches` (log a watch). */
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
  watchId: string;
}

/**
 * Body of `PUT /api/me/watches/:watchId` — patch semantics. Editing `score`
 * here updates the canonical score every attached club review displays.
 */
export interface EditWatchRequest {
  score?: number | null;
  watchedDate?: string | null;
  rewatch?: boolean;
  text?: string | null;
}
