import { ReviewCommentDto } from "../../../lib/types/lists";
import { db } from "../utils/database";

class ReviewCommentRepository {
  async getByWorkAndClub(
    workId: string,
    clubId: string,
  ): Promise<ReviewCommentDto[]> {
    const rows = await db
      .selectFrom("review_comment")
      .innerJoin("user", "user.id", "review_comment.user_id")
      .where("review_comment.work_id", "=", workId)
      .where("review_comment.club_id", "=", clubId)
      .select([
        "review_comment.id",
        "review_comment.work_id",
        "review_comment.user_id",
        "user.name as user_name",
        "user.image as user_image",
        "review_comment.content",
        "review_comment.created_date",
      ])
      .orderBy("review_comment.created_date", "asc")
      .execute();

    return rows.map((row) => ({
      id: String(row.id),
      workId: String(row.work_id),
      userId: String(row.user_id),
      userName: row.user_name,
      userImage: row.user_image ?? undefined,
      content: row.content,
      createdDate: new Date(String(row.created_date)).toISOString(),
    }));
  }

  async insert(
    workId: string,
    clubId: string,
    userId: string,
    content: string,
  ) {
    return db
      .insertInto("review_comment")
      .values({
        work_id: workId,
        club_id: clubId,
        user_id: userId,
        content,
      })
      .execute();
  }

  async deleteById(commentId: string, userId: string) {
    return db
      .deleteFrom("review_comment")
      .where("id", "=", commentId)
      .where("user_id", "=", userId)
      .execute();
  }
}

export default new ReviewCommentRepository();
