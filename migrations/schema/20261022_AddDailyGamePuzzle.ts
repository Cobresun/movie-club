import { Kysely, sql } from "kysely";

/**
 * One row per day of Closer, the daily movie game: the movie that is that
 * day's answer. The answer is drawn from the movies clubs have added the first
 * time anyone asks for the day, and written here so it stays put while the
 * pool keeps growing, and so later draws can avoid repeating it.
 */
export async function up(db: Kysely<unknown>) {
  await db.schema
    .createTable("daily_game_puzzle")
    .addColumn("puzzle_date", "date", (col) => col.primaryKey())
    .addColumn("external_id", "varchar(255)", (col) =>
      col.references("movie_details.external_id").onDelete("cascade").notNull(),
    )
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();
}

export async function down(db: Kysely<unknown>) {
  await db.schema.dropTable("daily_game_puzzle").execute();
}
