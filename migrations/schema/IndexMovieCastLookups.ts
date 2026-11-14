import { type Kysely, sql } from "kysely";

/**
 * Both reads of `movie_actors` look a set of movies up by `external_id` and
 * want the cast in billing order: the list/review summary (names, billing,
 * popularity) and the full cast for the detail drawer and the statistics
 * leaderboards (names, characters, photos). The only index on `external_id`,
 * `movie_actors_unique`, holds none of those columns, so every cast row of
 * every requested movie was fetched again from the primary index — tens of
 * thousands of point lookups for one club's reviews.
 *
 * This index stores every column those reads select, so they scan it alone.
 *
 * Raw SQL because Kysely's index builder has no `STORING`.
 */
async function up(db: Kysely<unknown>) {
  await sql`
    CREATE INDEX IF NOT EXISTS movie_actors_external_id_cast_order_idx
    ON movie_actors (external_id, cast_order)
    STORING (actor_name, popularity, character_name, profile_path)
  `.execute(db);
}

async function down(db: Kysely<unknown>) {
  await db.schema.dropIndex("movie_actors_external_id_cast_order_idx").ifExists().execute();
}

export default { name: "IndexMovieCastLookups", up, down };
