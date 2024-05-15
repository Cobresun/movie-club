import { db } from "../utils/database";

import { WorkListType } from "@/common/types/generated/db";

class ReviewRepository {
  async getReviewList(clubId: string) {
    return db
      .selectFrom("work_list")
      .where("work_list.club_id", "=", clubId)
      .where("work_list.type", "=", WorkListType.reviews)
      .innerJoin("work_list_item", "work_list_item.list_id", "work_list.id")
      .innerJoin("work", "work.id", "work_list_item.work_id")
      .leftJoin("review", "review.work_id", "work.id")
      .select([
        "work.id",
        "work.title",
        "work.type",
        "work.image_url",
        "work.external_id",
        "work_list_item.time_added",
        "review.score",
        "review.user_id",
      ])
      .execute();
  }

  async insertReview(
    clubId: string,
    workId: string,
    userId: string,
    score: number
  ) {
    const listId = await db
      .selectFrom("work_list")
      .select("id")
      .where("club_id", "=", clubId)
      .where("type", "=", WorkListType.reviews)
      .executeTakeFirstOrThrow();
    return db
      .insertInto("review")
      .values({
        list_id: listId.id,
        work_id: workId,
        user_id: userId,
        score,
        created_date: new Date(),
      })
      .execute();
  }
}

export default new ReviewRepository();
