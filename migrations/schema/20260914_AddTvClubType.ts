import { Kysely, sql } from "kysely";

/**
 * Adds the `tv` value to the existing `club_type` enum so a club can be a TV
 * club.
 *
 * This is intentionally the ONLY statement in the migration: CockroachDB does
 * not allow `ALTER TYPE ... ADD VALUE` to be combined with other schema
 * changes in the same transaction (and Kysely wraps each migration in one).
 * The matching `work_type` value lands in `20260914_AddTvWorkType`, and the
 * metadata tables in `20260914_AddTvDetails`.
 */
export async function up(db: Kysely<unknown>) {
  await sql`ALTER TYPE "club_type" ADD VALUE IF NOT EXISTS 'tv'`.execute(db);
}

export async function down() {
  // No-op: PostgreSQL/CockroachDB cannot remove a value from an enum type.
  // `up()` is idempotent via `IF NOT EXISTS`, so re-running forward is safe.
}
