import { Kysely } from "kysely";

export async function up(db: Kysely<unknown>) {
  await db.schema
    .createTable("club")
    .addColumn("id", "serial", (col) => col.primaryKey())
    .addColumn("name", "varchar(100)", (col) => col.notNull())
    .addColumn("legacy_id", "integer")
    .execute();
}

export async function down(db: Kysely<unknown>) {
  await db.schema.dropTable("club").execute();
}
