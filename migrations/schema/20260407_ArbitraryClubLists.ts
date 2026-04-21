import { Kysely, sql } from "kysely";

// Moves clubs from the rigid (watchlist | backlog | reviews | award_nominations)
// list model to a model where each club can have an arbitrary number of
// user-defined lists, plus optional "system" lists (reviews, award_nominations)
// distinguished by a new `system_type` column.
//
// The previous `type` column conflated identity (this is THE watchlist) with
// category. We split that responsibility:
//   - `title`              -> human-readable name, now NOT NULL
//   - `system_type`        -> nullable enum identifying system lists
//   - (no `type` column)   -> watchlist/backlog become regular user lists
//
// This is effectively a one-way migration. The down() restores the old shape
// well enough for local rollback during development, but any user-created
// lists beyond the first will be coalesced (we have nowhere to put them in
// the old enum).
export async function up(db: Kysely<unknown>) {
  // 1. New enum for system list identification.
  await db.schema
    .createType("work_list_system_type")
    .asEnum(["reviews", "award_nominations"])
    .execute();

  // 2. Add the new column (nullable for now so we can backfill).
  await db.schema
    .alterTable("work_list")
    .addColumn("system_type", sql`work_list_system_type`)
    .execute();

  // 3. Backfill system_type from the old `type` enum.
  await sql`
    UPDATE work_list
    SET system_type = 'reviews'
    WHERE type = 'reviews'
  `.execute(db);
  await sql`
    UPDATE work_list
    SET system_type = 'award_nominations'
    WHERE type = 'award_nominations'
  `.execute(db);

  // 4. Backfill missing titles using the historical default-title map so
  //    we can flip `title` to NOT NULL.
  await sql`
    UPDATE work_list
    SET title = CASE type
      WHEN 'watchlist' THEN 'Watch List'
      WHEN 'backlog' THEN 'Backlog'
      WHEN 'reviews' THEN 'Reviews'
      WHEN 'award_nominations' THEN 'Award Nominations'
    END
    WHERE title IS NULL
  `.execute(db);

  await db.schema
    .alterTable("work_list")
    .alterColumn("title", (col) => col.setNotNull())
    .execute();

  // 4b. Add `position` column with deterministic backfill. Watchlist gets
  //     slot 0 and backlog slot 1 on every club so the old stacked UX order
  //     falls out naturally. System lists and any other pre-existing rows
  //     get subsequent slots via a ROW_NUMBER over id (stable and unique
  //     per club). This has to run *before* we drop the `type` column.
  await db.schema
    .alterTable("work_list")
    .addColumn("position", "integer", (col) => col.notNull().defaultTo(0))
    .execute();

  await sql`UPDATE work_list SET position = 0 WHERE type = 'watchlist'`.execute(
    db,
  );
  await sql`UPDATE work_list SET position = 1 WHERE type = 'backlog'`.execute(
    db,
  );
  await sql`
    WITH ranked AS (
      SELECT id,
             ROW_NUMBER() OVER (PARTITION BY club_id ORDER BY id) + 1 AS rn
      FROM work_list
      WHERE type NOT IN ('watchlist', 'backlog')
    )
    UPDATE work_list AS w
    SET position = r.rn
    FROM ranked AS r
    WHERE w.id = r.id
  `.execute(db);

  // 5. Drop the unique(club_id, type) constraint — clubs may now have
  //    many user lists. CockroachDB stores unique constraints as unique
  //    indexes and doesn't support `ALTER TABLE DROP CONSTRAINT` for them
  //    (see crdb issue #42840), so we drop the underlying index with CASCADE.
  await sql`DROP INDEX uq_work_list_club_id_type CASCADE`.execute(db);

  // 6. Drop the old type-based index.
  await db.schema.dropIndex("idx_work_list_type").ifExists().execute();

  // 7. Drop the old `type` column.
  await db.schema.alterTable("work_list").dropColumn("type").execute();

  // 8. Drop the now-unreferenced enum.
  await db.schema.dropType("work_list_type").execute();

  // 9. Partial unique index: each club still has at most one of each system
  //    list. User lists (system_type IS NULL) are unconstrained.
  await sql`
    CREATE UNIQUE INDEX uq_work_list_club_system_type
      ON work_list (club_id, system_type)
      WHERE system_type IS NOT NULL
  `.execute(db);

  // 10. Index for the "list all lists for this club" query that drives the
  //     list switcher. Ordered by position so range scans read in order.
  await db.schema
    .createIndex("idx_work_list_club_id_position")
    .on("work_list")
    .columns(["club_id", "position"])
    .ifNotExists()
    .execute();
}

export async function down(db: Kysely<unknown>) {
  // Best-effort rollback. User lists beyond the first per club cannot be
  // represented in the old enum and will be dropped.
  await db.schema
    .createType("work_list_type")
    .asEnum(["backlog", "watchlist", "reviews", "award_nominations"])
    .execute();

  await db.schema
    .alterTable("work_list")
    .addColumn("type", sql`work_list_type`)
    .execute();

  // Reviews and award_nominations rows can be restored exactly.
  await sql`
    UPDATE work_list SET type = 'reviews' WHERE system_type = 'reviews'
  `.execute(db);
  await sql`
    UPDATE work_list SET type = 'award_nominations' WHERE system_type = 'award_nominations'
  `.execute(db);

  // For non-system lists, keep at most one per club, mapped to 'watchlist'.
  // Any extras are deleted (their items cascade away). This is a destructive
  // rollback by necessity.
  await sql`
    WITH ranked AS (
      SELECT id,
             ROW_NUMBER() OVER (PARTITION BY club_id ORDER BY id) AS rn
      FROM work_list
      WHERE system_type IS NULL
    )
    DELETE FROM work_list
    WHERE id IN (SELECT id FROM ranked WHERE rn > 1)
  `.execute(db);

  await sql`
    UPDATE work_list SET type = 'watchlist' WHERE system_type IS NULL
  `.execute(db);

  await db.schema
    .alterTable("work_list")
    .alterColumn("type", (col) => col.setNotNull())
    .execute();

  await sql`
    ALTER TABLE work_list
    ADD CONSTRAINT uq_work_list_club_id_type UNIQUE (club_id, type)
  `.execute(db);

  await db.schema
    .createIndex("idx_work_list_type")
    .on("work_list")
    .column("type")
    .execute();

  await sql`DROP INDEX IF EXISTS uq_work_list_club_system_type`.execute(db);
  await db.schema
    .dropIndex("idx_work_list_club_id_position")
    .ifExists()
    .execute();
  await db.schema.alterTable("work_list").dropColumn("position").execute();
  await db.schema.alterTable("work_list").dropColumn("system_type").execute();
  await db.schema.dropType("work_list_system_type").execute();

  await db.schema
    .alterTable("work_list")
    .alterColumn("title", (col) => col.dropNotNull())
    .execute();
}
