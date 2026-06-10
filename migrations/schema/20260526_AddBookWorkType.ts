import { Kysely, sql } from "kysely";

/**
 * Adds the `book` value to the existing `work_type` enum so a `work` row can
 * represent a book as well as a movie.
 *
 * This is intentionally the ONLY statement in the migration: CockroachDB does
 * not allow `ALTER TYPE ... ADD VALUE` to be combined with other schema
 * changes in the same transaction (and Kysely wraps each migration in one).
 * Everything else for book clubs lives in `20260526_AddBookClubs`.
 */
export async function up(db: Kysely<unknown>) {
  await sql`ALTER TYPE "work_type" ADD VALUE IF NOT EXISTS 'book'`.execute(db);
}

export async function down() {
  // No-op: PostgreSQL/CockroachDB cannot remove a value from an enum type.
  // `up()` is idempotent via `IF NOT EXISTS`, so re-running forward is safe.
}
