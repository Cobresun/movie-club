import { isDefined } from "../../../lib/checks/checks.js";
import { WorkType } from "../../../lib/types/generated/db";
import {
  DiaryWatch,
  ForWorkWatch,
  WatchClubReview,
} from "../../../lib/types/me";

/**
 * Shape of one row from `WatchRepository.getMyWatches` / `getWatchesForWork`.
 * Kept explicit (not inferred) so `mapDiaryRows` is a pure, DB-free unit-test
 * seam — the row is the boundary between Kysely and the DTO.
 *
 * Scalars mirror what Kysely returns for the underlying columns: `score` is a
 * `Numeric` (string), the date columns come back as `Date` (accepting `string`
 * too for hand-written test rows).
 */
export interface WatchStreamRow {
  watch_id: string;
  score: string | null;
  watched_date: Date | string | null;
  created_date: Date | string;
  rewatch: boolean;
  text: string | null;
  work_id: string;
  work_title: string;
  work_type: WorkType;
  work_external_id: string | null;
  work_image_url: string | null;
}

/**
 * One club review event from `WatchRepository.getClubReviewsForWatchIds`,
 * nested under its parent watch by `watch_id`.
 */
export interface ClubReviewRow {
  review_id: string;
  watch_id: string;
  created_date: Date | string;
  club_id: string;
  club_name: string;
  club_slug: string;
}

/** "YYYY-MM-DD" for a date column value, or null. */
function toDateString(value: Date | string | null): string | null {
  if (!isDefined(value)) return null;
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

/** ISO timestamp string for a timestamptz value. */
function toIsoString(value: Date | string): string {
  return typeof value === "string" ? value : value.toISOString();
}

function groupClubReviews(
  clubReviewRows: ClubReviewRow[],
): Map<string, WatchClubReview[]> {
  const byWatch = new Map<string, WatchClubReview[]>();
  for (const row of clubReviewRows) {
    const list = byWatch.get(row.watch_id) ?? [];
    list.push({
      reviewId: row.review_id,
      clubId: row.club_id,
      clubName: row.club_name,
      clubSlug: row.club_slug,
      createdDate: toIsoString(row.created_date),
    });
    byWatch.set(row.watch_id, list);
  }
  return byWatch;
}

function mapRow(
  row: WatchStreamRow,
  clubReviews: Map<string, WatchClubReview[]>,
): DiaryWatch {
  return {
    watchId: row.watch_id,
    work: {
      id: row.work_id,
      title: row.work_title,
      type: row.work_type,
      externalId: row.work_external_id,
      imageUrl: row.work_image_url,
    },
    score: isDefined(row.score) ? Number(row.score) : null,
    watchedDate: toDateString(row.watched_date),
    createdDate: toIsoString(row.created_date),
    rewatch: row.rewatch,
    text: row.text,
    clubReviews: clubReviews.get(row.watch_id) ?? [],
  };
}

/**
 * Pure rows → DTO mapping for `GET /api/me/watches`. Club review rows arrive
 * oldest-first from the repository and nest under their parent watch.
 */
export function mapDiaryRows(
  watchRows: WatchStreamRow[],
  clubReviewRows: ClubReviewRow[],
): DiaryWatch[] {
  const clubReviews = groupClubReviews(clubReviewRows);
  return watchRows.map((row) => mapRow(row, clubReviews));
}

/** Same rows, minus the (known) work, for `GET /api/me/watches/for-work`. */
export function mapForWorkRows(
  watchRows: WatchStreamRow[],
  clubReviewRows: ClubReviewRow[],
): ForWorkWatch[] {
  return mapDiaryRows(watchRows, clubReviewRows).map((watch) => ({
    watchId: watch.watchId,
    score: watch.score,
    watchedDate: watch.watchedDate,
    createdDate: watch.createdDate,
    rewatch: watch.rewatch,
    text: watch.text,
    clubReviews: watch.clubReviews,
  }));
}
