import { Kysely } from "kysely";

export async function up(db: Kysely<unknown>) {
  await db.schema
    .createTable("review")
    .addColumn("id", "serial", (col) => col.primaryKey())
    .addColumn("work_id", "int8", (col) => col.notNull())
    .addColumn("list_id", "int8", (col) => col.notNull())
    .addColumn("user_id", "int8", (col) => col.notNull())
    .addColumn("created_date", "timestamptz", (col) =>
      col.notNull().defaultTo("now()"),
    )
    .addColumn("score", "decimal", (col) => col.notNull())
    .addForeignKeyConstraint(
      "fk_review_work_list_item_id",
      ["list_id", "work_id"],
      "work_list_item",
      ["list_id", "work_id"],
      (cb) => cb.onDelete("cascade"),
    )
    .addForeignKeyConstraint(
      "fk_review_user_id",
      ["user_id"],
      "user",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .execute();

  await db.schema
    .alterTable("work_list_item")
    .dropColumn("created_date")
    .execute();
}

export async function down(db: Kysely<unknown>) {
  await db.schema.dropTable("review").execute();
  await db.schema
    .alterTable("work_list_item")
    .addColumn("created_date", "date")
    .execute();
}
