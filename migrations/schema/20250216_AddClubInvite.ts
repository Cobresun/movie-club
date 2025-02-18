import { Kysely } from "kysely";

export async function up(db: Kysely<unknown>) {
  await db.schema
    .createTable("club_invite")
    .addColumn("token", "text", (col) => col.primaryKey())
    .addColumn("club_id", "bigint", (col) =>
      col.notNull().references("club.id").onDelete("cascade"),
    )
    .addColumn("expires_at", "timestamptz", (col) => col.notNull())
    .execute();
}

export async function down(db: Kysely<unknown>) {
  await db.schema.dropTable("club_invite").execute();
}
