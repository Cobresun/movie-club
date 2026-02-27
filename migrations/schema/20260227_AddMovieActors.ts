import { Kysely } from "kysely";

export async function up(db: Kysely<unknown>) {
  await db.schema
    .createTable("movie_actors")
    .addColumn("external_id", "varchar(255)", (col) =>
      col.references("movie_details.external_id").onDelete("cascade").notNull(),
    )
    .addColumn("actor_name", "varchar(255)", (col) => col.notNull())
    .addColumn("cast_order", "integer", (col) => col.notNull())
    .addUniqueConstraint("movie_actors_unique", ["external_id", "actor_name"])
    .execute();
}

export async function down(db: Kysely<unknown>) {
  await db.schema.dropTable("movie_actors").execute();
}
