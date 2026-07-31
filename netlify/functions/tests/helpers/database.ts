import { db, pool } from "../../utils/database";

/**
 * Domain tables, children before parents so a single multi-statement DELETE
 * never trips a foreign key (CockroachDB checks constraints per statement).
 *
 * `user`, `account`, `session` and `verification` are deliberately absent:
 * signing a user up costs two bcrypt hashes, so the auth fixtures create their
 * users once per file and reuse them (see `helpers/auth.ts`). Nothing a test
 * asserts on is user-global — club membership, lists and reviews all hang off
 * `club`, which is wiped — so keeping the accounts around is invisible to
 * tests and saves the suite tens of seconds.
 */
const DOMAIN_TABLES = [
  "review",
  "work_list_item",
  "work_comment",
  "next_work",
  "work_list",
  "work",
  "club_settings",
  "club_invite",
  "club_member",
  "awards_temp",
  "club",
  "movie_actors",
  "movie_directors",
  "movie_genres",
  "movie_production_companies",
  "movie_production_countries",
  "movie_details",
  "book_authors",
  "book_subjects",
  "book_details",
];

/**
 * Empty every domain table between tests.
 *
 * `DELETE` rather than `TRUNCATE`: Cockroach implements TRUNCATE as a schema
 * change that costs ~750ms per call, while deleting from all twenty tables in
 * one round trip takes ~15ms.
 */
export async function resetDatabase() {
  await pool.query(DOMAIN_TABLES.map((table) => `DELETE FROM "${table}"`).join("; "));
}

/** Closes the connection pool so the worker can exit. */
export async function closeDatabase() {
  await pool.end();
}

export { db };
