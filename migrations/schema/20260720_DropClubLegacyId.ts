import { Kysely } from "kysely";

// Drops the vestigial `club.legacy_id` column. It dates back to the
// pre-CockroachDB club ids and became write-only dead weight: the only writer
// assigned a random value purely to satisfy the column, and PR #421 removed the
// last query path that read it. It was created as a plain nullable integer
// (20240126_AddClubTable) with no index, so a straight drop is enough — no
// unique-index CASCADE dance required.
export async function up(db: Kysely<unknown>) {
  await db.schema.alterTable("club").dropColumn("legacy_id").execute();
}

export async function down(db: Kysely<unknown>) {
  // Re-add the column in its original shape (nullable integer, no index).
  // The historical values were random throwaways, so there is nothing to
  // restore — new rows simply get NULL.
  await db.schema.alterTable("club").addColumn("legacy_id", "integer").execute();
}
