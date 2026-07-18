import { sql } from "kysely";

import { WorkListSystemType, WorkType } from "../../../lib/types/generated/db";
import { db } from "../utils/database";

interface InsertSoloReviewArgs {
  listId: string;
  workId: string;
  userId: string;
  score: number | null;
  watchedDate: string | null;
  rewatch: boolean;
  text: string | null;
}

interface SoloReviewPatch {
  score?: number | null;
  watchedDate?: string | null;
  rewatch?: boolean;
  text?: string | null;
}

class ReviewRepository {
  // Media-agnostic: one row per (work, review). The handler groups by work and
  // assembles per-user scores, then enriches with MediaProvider.getExternalData.
  async getReviewList(clubId: string) {
    return db
      .selectFrom("work_list")
      .where("work_list.club_id", "=", clubId)
      .where("work_list.system_type", "=", WorkListSystemType.reviews)
      .innerJoin("work_list_item", "work_list_item.list_id", "work_list.id")
      .innerJoin("work", "work.id", "work_list_item.work_id")
      .leftJoin("review", "review.work_id", "work.id")
      .select([
        "review.id as review_id",
        "work.id",
        "work.title",
        "work.type",
        "work.image_url",
        "work.external_id",
        "work_list_item.time_added",
        "review.score",
        "review.user_id",
        "review.created_date",
      ])
      .execute();
  }

  async insertReview(
    clubId: string,
    workId: string,
    userId: string,
    score: number,
  ) {
    const listId = await db
      .selectFrom("work_list")
      .select("id")
      .where("club_id", "=", clubId)
      .where("system_type", "=", WorkListSystemType.reviews)
      .executeTakeFirstOrThrow();
    return db
      .insertInto("review")
      .values({
        list_id: listId.id,
        work_id: workId,
        user_id: userId,
        score,
      })
      .execute();
  }

  async getById(id: string, clubId: string) {
    return db
      .selectFrom("review")
      .selectAll()
      .innerJoin("work_list", "work_list.id", "review.list_id")
      .where("work_list.club_id", "=", clubId)
      .where("review.id", "=", id)
      .executeTakeFirstOrThrow();
  }

  async updateScore(id: string, score: number) {
    return db
      .updateTable("review")
      .set("score", score)
      .set("created_date", new Date())
      .where("id", "=", id)
      .execute();
  }

  async getReviewsByWorkId(clubId: string, workId: string) {
    return db
      .selectFrom("work_list")
      .where("work_list.club_id", "=", clubId)
      .where("work_list.system_type", "=", WorkListSystemType.reviews)
      .innerJoin("work_list_item", "work_list_item.list_id", "work_list.id")
      .innerJoin("work", "work.id", "work_list_item.work_id")
      .where("work.id", "=", workId)
      .leftJoin("review", "review.work_id", "work.id")
      .select([
        "review.id as review_id",
        "review.score",
        "review.user_id",
        "review.created_date",
      ])
      .groupBy(["review.id", "work.id", "work_list_item.time_added"])
      .execute();
  }

  // -- Solo (user-scoped) review events ---------------------------------

  // Always an INSERT: solo logs are events, never deduped. One work can carry
  // many review rows (rewatches, re-reads). The composite FK
  // fk_review_work_list_item_id requires the work_list_item row to exist first,
  // so callers insert the list item before calling this.
  async insertSoloReview(args: InsertSoloReviewArgs) {
    return db
      .insertInto("review")
      .values({
        list_id: args.listId,
        work_id: args.workId,
        user_id: args.userId,
        score: args.score,
        watched_date: args.watchedDate,
        rewatch: args.rewatch,
        text: args.text,
      })
      .returning("id")
      .executeTakeFirstOrThrow();
  }

  // The user's full diary across every context: solo events plus their club
  // review rows (surfaced read-through — never copied). Context is derived by
  // the caller from list_user_id (solo) vs club_id/club_name/club_slug (club).
  private soloStreamBase() {
    return db
      .selectFrom("review")
      .innerJoin("work_list", "work_list.id", "review.list_id")
      .innerJoin("work", "work.id", "review.work_id")
      .leftJoin("club", "club.id", "work_list.club_id")
      .select([
        "review.id as review_id",
        "review.score as score",
        "review.watched_date as watched_date",
        "review.created_date as created_date",
        "review.rewatch as rewatch",
        "review.text as text",
        "work.id as work_id",
        "work.title as work_title",
        "work.type as work_type",
        "work.external_id as work_external_id",
        "work.image_url as work_image_url",
        "work_list.user_id as list_user_id",
        "work_list.club_id as club_id",
        "club.name as club_name",
        "club.slug as club_slug",
      ]);
  }

  async getMyReviewStream(userId: string) {
    return this.soloStreamBase()
      .where("review.user_id", "=", userId)
      .orderBy(
        sql`COALESCE(review.watched_date, review.created_date::date)`,
        "desc",
      )
      .orderBy("review.created_date", "desc")
      .execute();
  }

  async getEventsForWork(userId: string, type: WorkType, externalId: string) {
    return this.soloStreamBase()
      .where("review.user_id", "=", userId)
      .where("work.type", "=", type)
      .where("work.external_id", "=", externalId)
      .orderBy(
        sql`COALESCE(review.watched_date, review.created_date::date)`,
        "desc",
      )
      .orderBy("review.created_date", "desc")
      .execute();
  }

  // Solo-only lookup: joins through work_list.user_id, so a club review id
  // returns undefined. Doubles as the ownership gate for PUT/DELETE.
  async getSoloById(reviewId: string, userId: string) {
    return db
      .selectFrom("review")
      .innerJoin("work_list", "work_list.id", "review.list_id")
      .where("work_list.user_id", "=", userId)
      .where("review.id", "=", reviewId)
      .select("review.id")
      .executeTakeFirst();
  }

  // Patch semantics: only provided keys are written. Unlike the club
  // updateScore, this does NOT reset created_date (the event's log time is
  // stable; watched_date is the mutable "when watched").
  async updateSoloEvent(reviewId: string, patch: SoloReviewPatch) {
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
      .updateTable("review")
      .set(values)
      .where("id", "=", reviewId)
      .execute();
  }

  // Deletes the review event row only. The work + work_list_item stay behind
  // (inert, invisible without a review) — accepted M1 debt.
  async deleteSoloReview(reviewId: string) {
    return db.deleteFrom("review").where("id", "=", reviewId).execute();
  }
}

export default new ReviewRepository();
