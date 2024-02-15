import { Kysely } from "kysely";

export async function up(db: Kysely<unknown>) {
  await db.schema
    .createTable("user")
    .addColumn("id", "serial", (col) => col.primaryKey())
    .addColumn("username", "varchar(100)", (col) => col.unique().notNull())
    .addColumn("email", "varchar(255)", (col) => col.unique().notNull())
    .addColumn("image_url", "varchar(255)")
    .addColumn("image_id", "varchar(50)")
    .execute();

  await db.schema
    .createTable("club_member")
    .addColumn("club_id", "int8")
    .addColumn("user_id", "int8")
    .addColumn("role", "varchar(50)")
    .addPrimaryKeyConstraint("pk_club_member", ["club_id", "user_id"])
    .addForeignKeyConstraint(
      "fk_club_member_club_id",
      ["club_id"],
      "club",
      ["id"],
      (cb) => cb.onDelete("cascade")
    )
    .addForeignKeyConstraint(
      "fk_club_member_user_id",
      ["user_id"],
      "user",
      ["id"],
      (cb) => cb.onDelete("cascade")
    )
    .execute();
}

export async function down(db: Kysely<unknown>) {
  await db.schema.dropTable("club_member").execute();
  await db.schema.dropTable("user").execute();
}
