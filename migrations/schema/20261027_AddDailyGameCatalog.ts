import { Kysely, sql } from "kysely";

/**
 * The movies Closer draws from beyond the ones clubs have added: TMDB's most
 * widely rated films, which `scheduled-daily-game-catalog.ts` keeps topping
 * up. A row only marks a movie as part of the pool; its metadata lives in
 * `movie_details` like any other movie's.
 */
export async function up(db: Kysely<unknown>) {
  await db.schema
    .createTable("daily_game_catalog")
    .addColumn("external_id", "varchar(255)", (col) =>
      col.primaryKey().references("movie_details.external_id").onDelete("cascade"),
    )
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();
}

export async function down(db: Kysely<unknown>) {
  await db.schema.dropTable("daily_game_catalog").execute();
}
