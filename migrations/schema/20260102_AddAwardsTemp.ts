import { Kysely } from "kysely";

export async function up(db: Kysely<unknown>) {
  await db.schema
    .createTable("awards_temp")
    .addColumn("club_id", "bigint", (col) =>
      col.notNull().references("club.id").onDelete("cascade"),
    )
    .addColumn("year", "integer", (col) => col.notNull())
    .addColumn("data", "jsonb", (col) => col.notNull())
    .addPrimaryKeyConstraint("pk_awards_temp", ["club_id", "year"])
    .execute();
}

export async function down(db: Kysely<unknown>) {
  await db.schema.dropTable("awards_temp").execute();
}
