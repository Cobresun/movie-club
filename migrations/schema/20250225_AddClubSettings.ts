import { type Kysely } from "kysely";

async function up(db: Kysely<unknown>) {
  await db.schema
    .createTable("club_settings")
    .addColumn("club_id", "bigint", (col) =>
      col.notNull().references("club.id").onDelete("cascade"),
    )
    .addColumn("key", "varchar(50)", (col) => col.notNull())
    .addColumn("value", "jsonb", (col) => col.notNull())
    .addPrimaryKeyConstraint("pk_club_settings", ["club_id", "key"])
    .execute();
}

async function down(db: Kysely<unknown>) {
  await db.schema.dropTable("club_settings").execute();
}

export default { name: "20250225_AddClubSettings", up, down };
