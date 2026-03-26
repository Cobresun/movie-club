import { Kysely } from "kysely";

export async function up(db: Kysely<unknown>) {
  await db.schema
    .createTable("review_comment")
    .addColumn("id", "serial", (col) => col.primaryKey())
    .addColumn("work_id", "int8", (col) => col.notNull())
    .addColumn("club_id", "int8", (col) => col.notNull())
    .addColumn("user_id", "int8", (col) => col.notNull())
    .addColumn("content", "text", (col) => col.notNull())
    .addColumn("created_date", "timestamptz", (col) =>
      col.notNull().defaultTo("now()"),
    )
    .addForeignKeyConstraint(
      "fk_review_comment_club_id",
      ["club_id"],
      "club",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .addForeignKeyConstraint(
      "fk_review_comment_user_id",
      ["user_id"],
      "user",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .execute();
}

export async function down(db: Kysely<unknown>) {
  await db.schema.dropTable("review_comment").execute();
}
