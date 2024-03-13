import { db } from "../utils/database";

import { ListInsertDto } from "@/common/types/lists";

class WorkRepository {
  async findByType(clubId: string, type: string, externalId: string) {
    return db
      .selectFrom("work")
      .where("external_id", "=", externalId)
      .where("type", "=", type)
      .select(["id"])
      .executeTakeFirst();
  }

  async insert(clubId: string, work: ListInsertDto) {
    return db
      .insertInto("work")
      .values({
        club_id: clubId,
        title: work.title,
        type: work.type,
        external_id: work.externalId,
        image_url: work.imageUrl,
      })
      .returning("id")
      .executeTakeFirst();
  }

  async delete(clubId: string, workId: string) {
    return db
      .deleteFrom("work")
      .where("id", "=", workId)
      .where("club_id", "=", clubId)
      .execute();
  }
}

export default new WorkRepository();
