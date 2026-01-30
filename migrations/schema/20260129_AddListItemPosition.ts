import { Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>) {
  await db.schema
    .alterTable("work_list_item")
    .addColumn("position", "integer")
    .execute();

  await sql`
    UPDATE work_list_item
    SET position = sub.rn
    FROM (
      SELECT list_id, work_id, ROW_NUMBER() OVER (PARTITION BY list_id ORDER BY time_added ASC) AS rn
      FROM work_list_item
    ) sub
    WHERE work_list_item.list_id = sub.list_id AND work_list_item.work_id = sub.work_id
  `.execute(db);

  await db.schema
    .alterTable("work_list_item")
    .alterColumn("position", (col) => col.setNotNull())
    .execute();

  await db.schema
    .alterTable("work_list_item")
    .alterColumn("position", (col) => col.setDefault(0))
    .execute();
}

export async function down(db: Kysely<unknown>) {
  await db.schema.alterTable("work_list_item").dropColumn("position").execute();
}
