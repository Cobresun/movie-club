import { type Kysely } from "kysely";

async function up(db: Kysely<unknown>) {
  await db.schema
    .createTable("club")
    .addColumn("id", "serial", (col) => col.primaryKey())
    .addColumn("name", "varchar(100)", (col) => col.notNull())
    .addColumn("legacy_id", "integer")
    .execute();
}

async function down(db: Kysely<unknown>) {
  await db.schema.dropTable("club").execute();
}

export default { name: "20240126_AddClubTable", up, down };
