import { Kysely } from "kysely";

export async function up(db: Kysely<unknown>) {
  await db.schema
    .createTable("movie_directors")
    .addColumn("external_id", "varchar(255)", (col) =>
      col.references("movie_details.external_id").onDelete("cascade").notNull(),
    )
    .addColumn("director_name", "varchar(255)", (col) => col.notNull())
    .addUniqueConstraint("movie_directors_unique", [
      "external_id",
      "director_name",
    ])
    .execute();
}

export async function down(db: Kysely<unknown>) {
  await db.schema.dropTable("movie_directors").execute();
}
