import { Kysely } from "kysely";

export async function up(db: Kysely<unknown>) {
  await db.schema
    .alterTable("work_list_item")
    .alterColumn("created_date", (col) => col.dropNotNull())
    .execute();

  await db.schema
    .alterTable("work_list_item")
    .addColumn("time_added", "timestamptz", (col) =>
      col.notNull().defaultTo("now()")
    )
    .execute();
}

export async function down(db: Kysely<unknown>) {
  await db.schema
    .alterTable("work_list_item")
    .alterColumn("created_date", (col) => col.setNotNull())
    .execute();

  await db.schema
    .alterTable("work_list_item")
    .dropColumn("time_added")
    .execute();
}
