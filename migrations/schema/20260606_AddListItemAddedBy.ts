import { Kysely } from "kysely";

export async function up(db: Kysely<unknown>) {
  await db.schema.alterTable("work_list_item").addColumn("added_by_user_id", "int8").execute();

  await db.schema
    .alterTable("work_list_item")
    .addForeignKeyConstraint("fk_work_list_item_added_by_user_id", ["added_by_user_id"], "user", [
      "id",
    ])
    .onDelete("set null")
    .execute();
}

export async function down(db: Kysely<unknown>) {
  await db.schema.alterTable("work_list_item").dropColumn("added_by_user_id").execute();
}
