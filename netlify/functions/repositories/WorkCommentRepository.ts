import { WorkCommentDto } from "../../../lib/types/lists";
import { db } from "../utils/database";

class WorkCommentRepository {
  async getByWorkAndClub(
    workId: string,
    clubId: string,
  ): Promise<WorkCommentDto[]> {
    const rows = await db
      .selectFrom("work_comment")
      .innerJoin("user", "user.id", "work_comment.user_id")
      .where("work_comment.work_id", "=", workId)
      .where("work_comment.club_id", "=", clubId)
      .select([
        "work_comment.id",
        "work_comment.work_id",
        "work_comment.user_id",
        "user.name as user_name",
        "user.image as user_image",
        "work_comment.content",
        "work_comment.created_date",
        "work_comment.spoiler",
      ])
      .orderBy("work_comment.created_date", "asc")
      .execute();

    return rows.map((row) => ({
      id: String(row.id),
      workId: String(row.work_id),
      userId: String(row.user_id),
      userName: row.user_name,
      userImage: row.user_image ?? undefined,
      content: row.content,
      createdDate: new Date(String(row.created_date)).toISOString(),
      spoiler: row.spoiler,
    }));
  }

  async insert(
    workId: string,
    clubId: string,
    userId: string,
    content: string,
    spoiler: boolean,
  ) {
    return db
      .insertInto("work_comment")
      .values({
        work_id: workId,
        club_id: clubId,
        user_id: userId,
        content,
        spoiler,
      })
      .execute();
  }

  async updateContent(
    commentId: string,
    userId: string,
    content: string,
    spoiler?: boolean,
  ) {
    let query = db
      .updateTable("work_comment")
      .set("content", content)
      .where("id", "=", commentId)
      .where("user_id", "=", userId);
    if (spoiler !== undefined) {
      query = query.set("spoiler", spoiler);
    }
    return query.execute();
  }

  async getById(commentId: string) {
    return db
      .selectFrom("work_comment")
      .select(["id", "user_id"])
      .where("id", "=", commentId)
      .executeTakeFirst();
  }

  async deleteById(commentId: string) {
    return db.deleteFrom("work_comment").where("id", "=", commentId).execute();
  }
}

export default new WorkCommentRepository();
