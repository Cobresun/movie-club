import { db } from "../utils/database";

class ListRepository {
  async getListByType(clubId: string, type: string) {
    const listId = await db
      .selectFrom("work_list")
      .select("id")
      .where("club_id", "=", clubId)
      .where("type", "=", type)
      .executeTakeFirstOrThrow();

    return db
      .selectFrom("work_list_item")
      .where("list_id", "=", listId.id)
      .innerJoin("work", "work.id", "work_list_item.work_id")
      .select([
        "work.id",
        "work.title",
        "work.image_url",
        "work.external_id",
        "work_list_item.created_date",
      ])
      .execute();
  }
}

export default new ListRepository();
