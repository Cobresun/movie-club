import { Kysely, sql } from "kysely";

/**
 * Adds the `tv` value to the existing `work_type` enum so a `work` row can
 * represent a television show, season or episode.
 *
 * This is intentionally the ONLY statement in the migration: CockroachDB does
 * not allow `ALTER TYPE ... ADD VALUE` to be combined with other schema
 * changes in the same transaction (and Kysely wraps each migration in one).
 */
export async function up(db: Kysely<unknown>) {
  await sql`ALTER TYPE "work_type" ADD VALUE IF NOT EXISTS 'tv'`.execute(db);
}

export async function down() {
  // No-op: PostgreSQL/CockroachDB cannot remove a value from an enum type.
  // `up()` is idempotent via `IF NOT EXISTS`, so re-running forward is safe.
}
