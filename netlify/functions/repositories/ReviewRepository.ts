import { WorkListSystemType } from "../../../lib/types/generated/db";
import { db } from "../utils/database";

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

  /**
   * Every work `userId` has scored, across every club they are still a member
   * of — the cross-club comparison pool Score Assist draws on. Joining
   * `club_member` (rather than trusting the review rows alone) drops scores
   * left behind in clubs they have since left.
   */
  async getScoredWorksByUser(userId: string) {
    return db
      .selectFrom("review")
      .where("review.user_id", "=", userId)
      .innerJoin("work_list", "work_list.id", "review.list_id")
      .where("work_list.system_type", "=", WorkListSystemType.reviews)
      .innerJoin("club", "club.id", "work_list.club_id")
      .innerJoin("club_member", (join) =>
        join.onRef("club_member.club_id", "=", "club.id").on("club_member.user_id", "=", userId),
      )
      .innerJoin("work", "work.id", "review.work_id")
      .select([
        "work.id as work_id",
        "work.title",
        "work.type",
        "work.image_url",
        "work.external_id",
        "club.id as club_id",
        "club.name as club_name",
        "club.slug as club_slug",
        "review.score",
        "review.created_date",
      ])
      .execute();
  }

  async insertReview(clubId: string, workId: string, userId: string, score: number) {
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

  // Scoped to the club through the review's list, so a review id from another
  // club reads as "not found" rather than as somebody else's row. `selectAll`
  // is scoped to `review`: work_list has an `id` of its own that would
  // otherwise shadow the review's.
  async findById(id: string, clubId: string) {
    return db
      .selectFrom("review")
      .selectAll("review")
      .innerJoin("work_list", "work_list.id", "review.list_id")
      .where("work_list.club_id", "=", clubId)
      .where("review.id", "=", id)
      .executeTakeFirst();
  }

  async updateScore(id: string, score: number) {
    return db
      .updateTable("review")
      .set("score", score)
      .set("created_date", new Date())
      .where("id", "=", id)
      .execute();
  }

  async deleteById(id: string) {
    return db.deleteFrom("review").where("id", "=", id).execute();
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
      .select(["review.id as review_id", "review.score", "review.user_id", "review.created_date"])
      .groupBy(["review.id", "work.id", "work_list_item.time_added"])
      .execute();
  }
}

export default new ReviewRepository();
