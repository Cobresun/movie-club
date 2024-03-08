import { Kysely } from "kysely";

export async function up(db: Kysely<unknown>) {
  // Work
  await db.schema
    .createTable("work")
    .addColumn("id", "serial", (col) => col.primaryKey())
    .addColumn("club_id", "int8", (col) => col.notNull())
    .addForeignKeyConstraint(
      "fk_work_club_id",
      ["club_id"],
      "club",
      ["id"],
      (cb) => cb.onDelete("cascade")
    )
    .addColumn("type", "varchar(50)", (col) => col.notNull())
    .addColumn("title", "varchar(255)", (col) => col.notNull())
    .addColumn("external_id", "varchar(255)")
    .addColumn("image_url", "varchar(255)")
    .execute();

  // List
  await db.schema
    .createTable("work_list")
    .addColumn("id", "serial", (col) => col.primaryKey())
    .addColumn("club_id", "int8", (col) => col.notNull())
    .addForeignKeyConstraint(
      "fk_work_list_club_id",
      ["club_id"],
      "club",
      ["id"],
      (cb) => cb.onDelete("cascade")
    )
    .addColumn("type", "varchar(50)", (col) => col.notNull())
    .addColumn("title", "varchar(255)")
    .execute();

  // List items
  await db.schema
    .createTable("work_list_item")
    .addColumn("list_id", "int8")
    .addColumn("work_id", "int8")
    .addColumn("created_date", "date", (col) => col.notNull())
    .addPrimaryKeyConstraint("pk_work_list_item", ["list_id", "work_id"])
    .addForeignKeyConstraint(
      "fk_work_list_item_list_id",
      ["list_id"],
      "work_list",
      ["id"],
      (cb) => cb.onDelete("cascade")
    )
    .addForeignKeyConstraint(
      "fk_work_list_item_work_id",
      ["work_id"],
      "work",
      ["id"],
      (cb) => cb.onDelete("cascade")
    )
    .execute();
}

export async function down(db: Kysely<unknown>) {
  await db.schema.dropTable("work_list_item").execute();
  await db.schema.dropTable("work_list").execute();
  await db.schema.dropTable("work").execute();
}
