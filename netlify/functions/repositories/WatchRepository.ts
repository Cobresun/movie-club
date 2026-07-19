import { sql } from "kysely";

import { isDefined } from "../../../lib/checks/checks.js";
import { WorkType } from "../../../lib/types/generated/db";
import { db } from "../utils/database";

interface InsertWatchArgs {
  userId: string;
  workId: string;
  score: number | null;
  watchedDate: string | null;
  rewatch: boolean;
  text: string | null;
}

interface WatchPatch {
  score?: number | null;
  watchedDate?: string | null;
  rewatch?: boolean;
  text?: string | null;
}

// A watch is one physical viewing/reading by a user — the parent entity of the
// diary and the single owner of the canonical score. Club review rows point at
// their watch (review.watch_id), so club surfaces read and write the score
// through here rather than storing their own copy.
class WatchRepository {
  // Always an INSERT: watches are events, never deduped. One work can carry
  // many watches (rewatches, re-reads).
  async insertWatch(args: InsertWatchArgs) {
    return db
      .insertInto("watch")
      .values({
        user_id: args.userId,
        work_id: args.workId,
        score: args.score,
        watched_date: args.watchedDate,
        rewatch: args.rewatch,
        text: args.text,
      })
      .returning("id")
      .executeTakeFirstOrThrow();
  }

  // The watch a new club review attaches to: the most recent one, by the same
  // date ordering the diary displays.
  async getLatestForWork(userId: string, workId: string) {
    return db
      .selectFrom("watch")
      .where("user_id", "=", userId)
      .where("work_id", "=", workId)
      .orderBy(sql`COALESCE(watched_date, created_date::date)`, "desc")
      .orderBy("created_date", "desc")
      .select("id")
      .executeTakeFirst();
  }

  /**
   * Attach point for a club review: update the user's latest watch of the work
   * to the submitted score (the single watch row is what every other club and
   * the library read, so this IS the propagation), or — for a user reviewing a
   * work they never logged — create the watch implicitly, dated today.
   */
  async attachForClubReview(userId: string, workId: string, score: number) {
    const latest = await this.getLatestForWork(userId, workId);
    if (isDefined(latest)) {
      await this.updateScore(latest.id, score);
      return latest.id;
    }
    const inserted = await db
      .insertInto("watch")
      .values({
        user_id: userId,
        work_id: workId,
        score,
        watched_date: sql`CURRENT_DATE`,
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    return inserted.id;
  }

  async updateScore(watchId: string, score: number) {
    return db
      .updateTable("watch")
      .set({ score })
      .where("id", "=", watchId)
      .execute();
  }

  // Ownership gate for the /api/me PUT/DELETE handlers.
  async getByIdForUser(watchId: string, userId: string) {
    return db
      .selectFrom("watch")
      .where("id", "=", watchId)
      .where("user_id", "=", userId)
      .select("id")
      .executeTakeFirst();
  }

  // Deleting a watch with club reviews attached would orphan club history —
  // the FK is RESTRICT, and handlers use this to fail with a real message
  // instead of a constraint error.
  async clubReviewCount(watchId: string) {
    const row = await db
      .selectFrom("review")
      .where("watch_id", "=", watchId)
      .select(sql<number>`count(*)::int`.as("count"))
      .executeTakeFirstOrThrow();
    return row.count;
  }

  // Patch semantics: only provided keys are written. created_date (the log
  // time) is stable; watched_date is the mutable "when watched".
  async updateWatch(watchId: string, patch: WatchPatch) {
    const values: {
      score?: number | null;
      watched_date?: string | null;
      rewatch?: boolean;
      text?: string | null;
    } = {};
    if (patch.score !== undefined) values.score = patch.score;
    if (patch.watchedDate !== undefined)
      values.watched_date = patch.watchedDate;
    if (patch.rewatch !== undefined) values.rewatch = patch.rewatch;
    if (patch.text !== undefined) values.text = patch.text;

    if (Object.keys(values).length === 0) return;

    return db
      .updateTable("watch")
      .set(values)
      .where("id", "=", watchId)
      .execute();
  }

  // Deletes the watch row only. The work stays behind (inert, invisible
  // without a watch) — accepted M1 debt.
  async deleteWatch(watchId: string) {
    return db.deleteFrom("watch").where("id", "=", watchId).execute();
  }

  // -- Diary reads -------------------------------------------------------

  private watchStreamBase() {
    return db
      .selectFrom("watch")
      .innerJoin("work", "work.id", "watch.work_id")
      .select([
        "watch.id as watch_id",
        "watch.score as score",
        "watch.watched_date as watched_date",
        "watch.created_date as created_date",
        "watch.rewatch as rewatch",
        "watch.text as text",
        "work.id as work_id",
        "work.title as work_title",
        "work.type as work_type",
        "work.external_id as work_external_id",
        "work.image_url as work_image_url",
      ])
      .orderBy(
        sql`COALESCE(watch.watched_date, watch.created_date::date)`,
        "desc",
      )
      .orderBy("watch.created_date", "desc");
  }

  async getMyWatches(userId: string) {
    return this.watchStreamBase().where("watch.user_id", "=", userId).execute();
  }

  async getWatchesForWork(userId: string, type: WorkType, externalId: string) {
    return this.watchStreamBase()
      .where("watch.user_id", "=", userId)
      .where("work.type", "=", type)
      .where("work.external_id", "=", externalId)
      .execute();
  }

  // The club review events for a set of watches, oldest-first, for nesting
  // under their parent watch in the diary DTOs.
  async getClubReviewsForWatchIds(watchIds: string[]) {
    if (watchIds.length === 0) return [];
    return db
      .selectFrom("review")
      .innerJoin("work_list", "work_list.id", "review.list_id")
      .innerJoin("club", "club.id", "work_list.club_id")
      .where("review.watch_id", "in", watchIds)
      .select([
        "review.id as review_id",
        "review.watch_id as watch_id",
        "review.created_date as created_date",
        "club.id as club_id",
        "club.name as club_name",
        "club.slug as club_slug",
      ])
      .orderBy("review.created_date", "asc")
      .execute();
  }
}

export default new WatchRepository();
