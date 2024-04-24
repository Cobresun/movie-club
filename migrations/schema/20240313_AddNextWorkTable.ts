import { Kysely } from "kysely";

export async function up(db: Kysely<unknown>) {
  await db.schema
    .createTable("next_work")
    .addColumn("id", "serial", (col) => col.primaryKey())
    .addColumn("work_id", "int8", (col) => col.notNull())
    .addColumn("club_id", "int8", (col) => col.notNull())
    .addForeignKeyConstraint(
      "fk_next_work_club_id",
      ["club_id"],
      "club",
      ["id"],
      (cb) => cb.onDelete("cascade")
    )
    .addForeignKeyConstraint(
      "fk_next_work_work_id",
      ["work_id"],
      "work",
      ["id"],
      (cb) => cb.onDelete("cascade")
    )
    .execute();

  await db.schema
    .alterTable("work")
    .addUniqueConstraint("uq_club_id_type_external_id", [
      "club_id",
      "type",
      "external_id",
    ])
    .execute();
}

export async function down(db: Kysely<unknown>) {
  await db.schema.dropTable("next_work").execute();
}
