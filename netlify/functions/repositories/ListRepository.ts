import { ValueExpression, expressionBuilder } from "kysely";
import { DB } from "kysely-codegen";

import { db } from "../utils/database";

class ListRepository {
  async getListByType(clubId: string, type: string) {
    return db
      .selectFrom("work_list")
      .where("work_list.club_id", "=", clubId)
      .where("work_list.type", "=", type)
      .innerJoin("work_list_item", "work_list_item.list_id", "work_list.id")
      .innerJoin("work", "work.id", "work_list_item.work_id")
      .select([
        "work.id",
        "work.title",
        "work.type",
        "work.image_url",
        "work.external_id",
        "work_list_item.created_date",
      ])
      .execute();
  }

  async isItemInList(clubId: string, listType: string, workId: string) {
    return !!(await db
      .selectFrom("work_list_item")
      .select("list_id")
      .where("work_list_item.work_id", "=", workId)
      .where(
        "work_list_item.list_id",
        "=",
        this.listIdFromType(clubId, listType)
      )
      .executeTakeFirst());
  }

  async insertItemInList(clubId: string, listType: string, workId: string) {
    return db
      .insertInto("work_list_item")
      .values({
        list_id: this.listIdFromType(clubId, listType),
        work_id: workId,
        created_date: new Date(),
      })
      .execute();
  }

  async deleteItemFromList(clubId: string, listType: string, workId: string) {
    return db
      .deleteFrom("work_list_item")
      .where("work_list_item.work_id", "=", workId)
      .where(
        "work_list_item.list_id",
        "=",
        this.listIdFromType(clubId, listType)
      )
      .execute();
  }

  private listIdFromType(
    clubId: string,
    type: string
  ): ValueExpression<DB, "work_list_item", string> {
    const eb = expressionBuilder<DB, "work_list_item">();
    return eb
      .selectFrom("work_list")
      .where("club_id", "=", clubId)
      .where("type", "=", type)
      .select("id");
  }
}

export default new ListRepository();
