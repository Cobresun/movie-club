import { ValueExpression, expressionBuilder } from "kysely";

import { db } from "../utils/database";

import { DB, WorkListType } from "@/common/types/generated/db";

class ListRepository {
  async getListByType(clubId: string, type: WorkListType) {
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
        "work_list_item.time_added",
      ])
      .execute();
  }

  async isItemInList(clubId: string, listType: WorkListType, workId: string) {
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

  async insertItemInList(
    clubId: string,
    listType: WorkListType,
    workId: string
  ) {
    return db
      .insertInto("work_list_item")
      .values({
        list_id: this.listIdFromType(clubId, listType),
        work_id: workId,
      })
      .execute();
  }

  async deleteItemFromList(
    clubId: string,
    listType: WorkListType,
    workId: string
  ) {
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
    type: WorkListType
  ): ValueExpression<DB, "work_list_item", string> {
    const eb = expressionBuilder<DB, "work_list_item">();
    return eb
      .selectFrom("work_list")
      .where("club_id", "=", clubId)
      .where("type", "=", type)
      .select("id");
  }
}

export function isWorkListType(type: string): type is WorkListType {
  return Object.values(WorkListType).includes(type as WorkListType);
}

export default new ListRepository();
