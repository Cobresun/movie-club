import { WorkListSystemType } from "../../../lib/types/generated/db";
import { db } from "../utils/database";

// Club review events. A review row is one "reviewed in this club" event that
// points at its parent watch (review.watch_id) — the watch owns the canonical
// score, so every score column selected here is read through that join.
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
      .leftJoin("watch", "watch.id", "review.watch_id")
      .select([
        "review.id as review_id",
        "work.id",
        "work.title",
        "work.type",
        "work.image_url",
        "work.external_id",
        "work_list_item.time_added",
        "watch.score as score",
        "review.user_id",
        "review.created_date",
      ])
      .execute();
  }

  async insertReview(
    clubId: string,
    workId: string,
    userId: string,
    watchId: string,
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
        watch_id: watchId,
      })
      .execute();
  }

  async getById(id: string, clubId: string) {
    // selectAll("review"), not selectAll(): the joined work_list shares column
    // names with review (id, and user_id since Solo Spaces) and a bare
    // selectAll() lets work_list's NULL user_id shadow review.user_id in the
    // flattened row, breaking the ownership check in the PUT handler.
    return db
      .selectFrom("review")
      .selectAll("review")
      .innerJoin("work_list", "work_list.id", "review.list_id")
      .where("work_list.club_id", "=", clubId)
      .where("review.id", "=", id)
      .executeTakeFirstOrThrow();
  }

  // A re-score bumps the event's created_date ("date reviewed") — the score
  // itself lives on the watch and is updated via WatchRepository.
  async touchCreatedDate(id: string) {
    return db
      .updateTable("review")
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
      .leftJoin("watch", "watch.id", "review.watch_id")
      .select([
        "review.id as review_id",
        "watch.score as score",
        "review.user_id",
        "review.created_date",
      ])
      .groupBy([
        "review.id",
        "watch.score",
        "work.id",
        "work_list_item.time_added",
      ])
      .execute();
  }
}

export default new ReviewRepository();
