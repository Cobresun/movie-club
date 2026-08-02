import { DB } from "../../../../lib/types/generated/db";
import { pool } from "../../utils/database";

/**
 * Tables `resetDatabase()` deliberately leaves alone.
 *
 * Signing a user up costs two bcrypt hashes, so the auth fixtures create their
 * users once per file and reuse them (see `helpers/auth.ts`). Nothing a test
 * asserts on is user-global — club membership, lists and reviews all hang off
 * `club`, which is wiped — so keeping the accounts around is invisible to tests
 * and saves the suite tens of seconds.
 */
const PRESERVED_TABLES = ["account", "session", "user", "verification"] as const;

type DomainTable = Exclude<keyof DB, (typeof PRESERVED_TABLES)[number]>;

/**
 * Everything else, children before parents so a single multi-statement DELETE
 * never trips a foreign key (CockroachDB checks constraints per statement).
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
] as const satisfies readonly DomainTable[];

/**
 * Fails to compile when `npm run codegen` adds a table that is neither listed
 * above nor preserved, naming the offender:
 *
 *   Type '"new_table"' does not satisfy the constraint 'never'.
 *
 * The fix is to decide which list it belongs on — silently leaving a table
 * un-reset would leak rows between tests.
 */
type AssertEveryTableHandled<T extends never> = T;
type _EveryTableHandled = AssertEveryTableHandled<
  Exclude<DomainTable, (typeof DOMAIN_TABLES)[number]>
>;

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
