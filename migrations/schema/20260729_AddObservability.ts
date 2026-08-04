import { Kysely, sql } from "kysely";

/**
 * Snapshot of just the columns the backfill reads/writes, so its queries are
 * type-checked against the schema rather than stringly-typed SQL. The migration
 * handle is `Kysely<unknown>`, so `withTables` is how we teach it about these
 * tables (including the `created_at` columns added moments earlier). int8 keys
 * come back from CockroachDB as strings.
 */
type MigrationTables = {
  club: { id: string; created_at: Date | null };
  club_member: { club_id: string; created_at: Date | null };
  work_list: { id: string; club_id: string };
  work_list_item: { list_id: string; time_added: Date };
  review: { list_id: string; created_date: Date };
};

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

  const typedDb = db.withTables<MigrationTables>();

  // Earliest activity per club, across both signals that carry a timestamp.
  // Clubs with no reviews and no list items match nothing here and stay NULL.
  const earliestActivity = typedDb
    .selectFrom((eb) =>
      eb
        .selectFrom("work_list_item")
        .select(["list_id", "time_added as ts"])
        .unionAll(eb.selectFrom("review").select(["list_id", "created_date as ts"]))
        .as("activity"),
    )
    .innerJoin("work_list", "work_list.id", "activity.list_id")
    .select((eb) => ["work_list.club_id", eb.fn.min("activity.ts").as("first_activity")])
    .groupBy("work_list.club_id");

  await typedDb
    .updateTable("club")
    .from(earliestActivity.as("earliest"))
    .set((eb) => ({ created_at: eb.ref("earliest.first_activity") }))
    .whereRef("club.id", "=", "earliest.club_id")
    .execute();

  // There is no per-membership signal to date a join from, so members inherit
  // their club's backfilled date (NULL included — an unknown club start means an
  // unknown join date). Only memberships created after this migration are exact.
  await typedDb
    .updateTable("club_member")
    .from("club")
    .set((eb) => ({ created_at: eb.ref("club.created_at") }))
    .whereRef("club_member.club_id", "=", "club.id")
    .execute();

  for (const table of ["club", "club_member"] as const) {
    await db.schema
      .alterTable(table)
      .alterColumn("created_at", (col) => col.setDefault(sql`now()`))
      .execute();
  }

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
