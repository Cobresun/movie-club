import { isDefined, ensure } from "../../../lib/checks/checks.js";
import { WorkType } from "../../../lib/types/generated/db";
import { DiaryEntry, ForWorkEvent } from "../../../lib/types/me";

/**
 * Shape of one aggregated row from `ReviewRepository.getMyReviewStream` /
 * `getEventsForWork`. Kept explicit (not inferred) so `mapDiaryRows` is a pure,
 * DB-free unit-test seam — the row is the boundary between Kysely and the DTO.
 *
 * Scalars mirror what Kysely returns for the underlying columns: `score` is a
 * `Numeric` (string), the date columns come back as `Date` (accepting `string`
 * too for hand-written test rows), and the club columns are nullable via the
 * left join.
 */
export interface DiaryStreamRow {
  review_id: string;
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
  list_user_id: string | null;
  club_id: string | null;
  club_name: string | null;
  club_slug: string | null;
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

function mapRow(row: DiaryStreamRow): DiaryEntry {
  // Solo events live on the user's own list (list_user_id set); every other
  // row is a club review row surfaced read-through.
  const context: DiaryEntry["context"] = isDefined(row.list_user_id)
    ? { kind: "solo" }
    : {
        kind: "club",
        clubId: ensure(row.club_id),
        clubName: ensure(row.club_name),
        clubSlug: ensure(row.club_slug),
      };

  return {
    reviewId: row.review_id,
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
    context,
  };
}

/** Pure row → DTO mapping for `GET /api/me/reviews`. */
export function mapDiaryRows(rows: DiaryStreamRow[]): DiaryEntry[] {
  return rows.map(mapRow);
}

/** Same rows, minus the (known) work, for `GET /api/me/reviews/for-work`. */
export function mapForWorkRows(rows: DiaryStreamRow[]): ForWorkEvent[] {
  return rows.map((row) => {
    const entry = mapRow(row);
    return {
      reviewId: entry.reviewId,
      score: entry.score,
      watchedDate: entry.watchedDate,
      createdDate: entry.createdDate,
      rewatch: entry.rewatch,
      text: entry.text,
      context: entry.context,
    };
  });
}
