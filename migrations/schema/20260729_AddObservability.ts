import { Kysely, sql } from "kysely";

/**
 * Groundwork for the site-wide observability dashboard (/admin).
 *
 * Two things this adds that cannot be reconstructed later:
 *
 * 1. `created_at` on `club` and `club_member`. Neither table has ever carried a
 *    timestamp, so "clubs created per week" was simply not answerable.
 *
 *    The column is **nullable on purpose**. Existing rows are backfilled to the
 *    club's earliest observable activity — the min of `work_list_item.time_added`
 *    and `review.created_date`, reached through `work_list.club_id` — and clubs
 *    with no activity at all keep NULL, meaning *unknown*. Defaulting those to
 *    now() would have been a lie that reads as a spike of brand-new clubs on the
 *    day this migration ran. NULL never satisfies a `>= cutoff` comparison, so
 *    unknown rows drop out of every window count instead of inflating it.
 *
 *    Note the ordering below: the column is added with no default (Postgres
 *    would otherwise fill every existing row), backfilled, and only then given
 *    `DEFAULT now()` so that rows created from here on are dated accurately.
 *
 *    Backfilled dates are a *floor*, not the true creation instant — a club is
 *    at least as old as its first review. Anything charted from historical
 *    buckets is labelled as approximate.
 *
 * 2. `metric_snapshot`, a daily roll-up written by
 *    `netlify/functions/scheduled-metrics-snapshot.ts`. Some metrics decay: Better
 *    Auth prunes expired `session` rows, so historical monthly-active-user counts
 *    disappear from the live tables. Snapshotting is the only way to retain them,
 *    and every day without it is lost permanently.
 *
 *    `metrics` is a single jsonb blob rather than a column per metric so that
 *    adding a metric is a code change, not a migration. Precedent:
 *    `awards_temp.data` and `club_settings.value`.
 */
export async function up(db: Kysely<unknown>) {
  await db.schema.alterTable("club").addColumn("created_at", "timestamptz").execute();
  await db.schema.alterTable("club_member").addColumn("created_at", "timestamptz").execute();

  // Earliest activity per club, across both signals that carry a timestamp.
  // Clubs with no reviews and no list items match nothing here and stay NULL.
  await sql`
    UPDATE club
    SET created_at = earliest.first_activity
    FROM (
      SELECT work_list.club_id AS club_id, MIN(activity.ts) AS first_activity
      FROM (
        SELECT list_id, time_added AS ts FROM work_list_item
        UNION ALL
        SELECT list_id, created_date AS ts FROM review
      ) AS activity
      JOIN work_list ON work_list.id = activity.list_id
      GROUP BY work_list.club_id
    ) AS earliest
    WHERE club.id = earliest.club_id
  `.execute(db);

  // There is no per-membership signal to date a join from, so members inherit
  // their club's backfilled date (NULL included — an unknown club start means an
  // unknown join date). Only memberships created after this migration are exact.
  await sql`
    UPDATE club_member
    SET created_at = club.created_at
    FROM club
    WHERE club_member.club_id = club.id
  `.execute(db);

  await sql`ALTER TABLE club ALTER COLUMN created_at SET DEFAULT now()`.execute(db);
  await sql`ALTER TABLE club_member ALTER COLUMN created_at SET DEFAULT now()`.execute(db);

  await db.schema
    .createTable("metric_snapshot")
    .addColumn("id", "serial", (col) => col.primaryKey())
    .addColumn("captured_on", "date", (col) => col.notNull().unique())
    .addColumn("metrics", "jsonb", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();
}

export async function down(db: Kysely<unknown>) {
  await db.schema.dropTable("metric_snapshot").execute();
  await db.schema.alterTable("club_member").dropColumn("created_at").execute();
  await db.schema.alterTable("club").dropColumn("created_at").execute();
}
