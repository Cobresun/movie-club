import { Kysely, sql } from "kysely";

// Solo Spaces (Milestone 1) — two related changes:
//
// 1. Ownership XOR: a `work` / `work_list` can belong to an individual user
//    ("solo") instead of a club. Every work_list and work row is owned by
//    EXACTLY ONE of club_id / user_id. Existing rows all have (club_id set,
//    user_id null) and satisfy the new XOR CHECK unchanged.
//
// 2. The `watch` table: one row per physical viewing/reading by a user, the
//    parent of club review events. A watch owns the canonical score and the
//    watched date; `review` rows become club events that point at their parent
//    watch (review.watch_id) and no longer carry a score of their own — every
//    club surface reads the score through the watch, so a score edit in any
//    club (or solo) updates everywhere at once.
//
//    watch.work_id points at the USER's solo-owned copy of the work (created
//    here by backfill, and lazily by the app), because club work rows are
//    per-club copies and a watch spans clubs.
//
// Backfill: existing club reviews are grouped per (user, work identity) into
// one watch each — identity is (type, external_id), falling back to
// (type, title) for manual works with no external id. The watch takes the
// LATEST review's score (score edits bump review.created_date, so latest
// created_date = most recent score) and the EARLIEST review's created_date as
// its watched_date. A user who scored the same work differently in two clubs
// ends up with the latest score everywhere — accepted product decision.
//
// Dev-only note: databases that ran the earlier draft of this migration may
// have solo review rows and extra review columns (watched_date, rewatch, text,
// source, source_ref). Those rows fold into the backfill like club rows
// (per-event text/dates collapse into one watch — accepted for dev data) and
// the leftover columns are dropped at the end.
//
// CockroachDB has NO transactional DDL: a migration that errors midway leaves
// the created columns/constraints/indexes in place. Every step below is
// therefore idempotent (IF NOT EXISTS / DROP NOT NULL no-ops / constraint and
// column guards) so a partial failure can simply be re-run.

// CRDB cannot express "ADD CONSTRAINT IF NOT EXISTS" for CHECK/FK constraints,
// so we guard by looking the constraint up in the catalog by name.
async function constraintExists(db: Kysely<unknown>, name: string) {
  const row = await sql<{ c: number }>`
    SELECT count(*)::int AS c FROM pg_catalog.pg_constraint WHERE conname = ${name}
  `.execute(db);
  return (row.rows[0]?.c ?? 0) > 0;
}

// The backfill reads review.score, which the final step drops — on a re-run
// after a partial failure the whole backfill block must be skipped once the
// column is gone (its work is necessarily complete by then).
async function columnExists(
  db: Kysely<unknown>,
  table: string,
  column: string,
) {
  const row = await sql<{ c: number }>`
    SELECT count(*)::int AS c
    FROM information_schema.columns
    WHERE table_name = ${table} AND column_name = ${column}
  `.execute(db);
  return (row.rows[0]?.c ?? 0) > 0;
}

export async function up(db: Kysely<unknown>) {
  // 1. work_list.club_id becomes nullable (solo lists have no club). Keep the
  //    existing fk_work_list_club_id FK — a nullable FK column is fine.
  //    DROP NOT NULL is a no-op if already nullable, so it is re-runnable.
  await sql`ALTER TABLE work_list ALTER COLUMN club_id DROP NOT NULL`.execute(
    db,
  );

  // 2. work_list.user_id (nullable) + guarded FK to user(id) ON DELETE CASCADE.
  await sql`ALTER TABLE work_list ADD COLUMN IF NOT EXISTS user_id INT8`.execute(
    db,
  );
  if (!(await constraintExists(db, "fk_work_list_user_id"))) {
    await db.schema
      .alterTable("work_list")
      .addForeignKeyConstraint("fk_work_list_user_id", ["user_id"], "user", [
        "id",
      ])
      .onDelete("cascade")
      .execute();
  }

  // 3. work.club_id becomes nullable (solo works have no club). Keep the
  //    existing fk_work_club_id FK.
  await sql`ALTER TABLE work ALTER COLUMN club_id DROP NOT NULL`.execute(db);

  // 4. work.user_id (nullable) + guarded FK to user(id) ON DELETE CASCADE.
  await sql`ALTER TABLE work ADD COLUMN IF NOT EXISTS user_id INT8`.execute(db);
  if (!(await constraintExists(db, "fk_work_user_id"))) {
    await db.schema
      .alterTable("work")
      .addForeignKeyConstraint("fk_work_user_id", ["user_id"], "user", ["id"])
      .onDelete("cascade")
      .execute();
  }

  // 5. XOR ownership CHECKs: exactly one of club_id / user_id is set. Existing
  //    rows (club set, user null) satisfy this. `!=` on two booleans is XOR.
  if (!(await constraintExists(db, "chk_work_list_owner"))) {
    await sql`
      ALTER TABLE work_list
      ADD CONSTRAINT chk_work_list_owner
      CHECK ((club_id IS NULL) != (user_id IS NULL))
    `.execute(db);
  }
  if (!(await constraintExists(db, "chk_work_owner"))) {
    await sql`
      ALTER TABLE work
      ADD CONSTRAINT chk_work_owner
      CHECK ((club_id IS NULL) != (user_id IS NULL))
    `.execute(db);
  }

  // 6. Partial unique index: at most one system list per (user, system_type) —
  //    the solo analogue of uq_work_list_club_system_type, which stays as-is
  //    (its NULL user_id rows never conflict with solo rows). Kysely's builder
  //    can't express a partial index, so use raw sql.
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_work_list_user_system_type
      ON work_list (user_id, system_type)
      WHERE system_type IS NOT NULL AND user_id IS NOT NULL
  `.execute(db);

  // 7. Partial unique index for solo work dedupe — the solo analogue of
  //    uq_club_id_type_external_id (which stays as-is; its solo rows have
  //    club_id NULL and NULLs are distinct, so no false conflicts).
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_work_user_type_external_id
      ON work (user_id, type, external_id)
      WHERE user_id IS NOT NULL
  `.execute(db);

  // 8. Index for the "list all of a user's lists" query, ordered by position —
  //    the solo analogue of idx_work_list_club_id_position.
  await db.schema
    .createIndex("idx_work_list_user_id_position")
    .on("work_list")
    .columns(["user_id", "position"])
    .ifNotExists()
    .execute();

  // 9. The watch table. score/watched_date are nullable ("log without a score"
  //    and "don't remember when" are real features); text is the owner's
  //    private note; source/source_ref reserve provenance columns for imports
  //    (Letterboxd etc. — an M3 concern, no unique index yet).
  await db.schema
    .createTable("watch")
    .ifNotExists()
    .addColumn("id", "serial", (col) => col.primaryKey())
    .addColumn("user_id", "int8", (col) => col.notNull())
    .addColumn("work_id", "int8", (col) => col.notNull())
    .addColumn("watched_date", "date")
    .addColumn("score", "decimal")
    .addColumn("text", "varchar")
    .addColumn("rewatch", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("source", "varchar")
    .addColumn("source_ref", "varchar")
    .addColumn("created_date", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addForeignKeyConstraint(
      "fk_watch_user_id",
      ["user_id"],
      "user",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .addForeignKeyConstraint(
      "fk_watch_work_id",
      ["work_id"],
      "work",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .execute();

  // Diary ordering + "latest watch of this work" resolution.
  await db.schema
    .createIndex("idx_watch_user_id_watched_date")
    .on("watch")
    .columns(["user_id", "watched_date"])
    .ifNotExists()
    .execute();
  await db.schema
    .createIndex("idx_watch_user_id_work_id")
    .on("watch")
    .columns(["user_id", "work_id"])
    .ifNotExists()
    .execute();

  // 10. review.watch_id — nullable for the backfill window, NOT NULL after.
  await sql`ALTER TABLE review ADD COLUMN IF NOT EXISTS watch_id INT8`.execute(
    db,
  );
  await db.schema
    .createIndex("idx_review_watch_id")
    .on("review")
    .columns(["watch_id"])
    .ifNotExists()
    .execute();

  // 11. Backfill. Skipped entirely once review.score is gone (see helper).
  if (await columnExists(db, "review", "score")) {
    // 11a. Solo copies of every externally-identified work a user has reviewed.
    //      DISTINCT ON dedupes within the batch; NOT EXISTS dedupes against
    //      already-present solo works (including a re-run after a mid-fail);
    //      ON CONFLICT covers the remaining concurrent-write race.
    await sql`
      INSERT INTO work (user_id, title, type, external_id, image_url)
      SELECT DISTINCT ON (r.user_id, w.type, w.external_id)
        r.user_id, w.title, w.type, w.external_id, w.image_url
      FROM review r
      JOIN work w ON w.id = r.work_id
      WHERE r.watch_id IS NULL
        AND w.external_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM work sw
          WHERE sw.user_id = r.user_id
            AND sw.type = w.type
            AND sw.external_id = w.external_id
        )
      ON CONFLICT DO NOTHING
    `.execute(db);

    // 11b. One watch per (user, solo work): latest review's score (DISTINCT ON
    //      ordered by created_date DESC), earliest review's created_date as the
    //      watched_date (window MIN — windows evaluate before DISTINCT ON).
    await sql`
      INSERT INTO watch (user_id, work_id, watched_date, score, created_date)
      SELECT DISTINCT ON (r.user_id, sw.id)
        r.user_id,
        sw.id,
        (min(r.created_date) OVER (PARTITION BY r.user_id, sw.id))::date,
        r.score,
        min(r.created_date) OVER (PARTITION BY r.user_id, sw.id)
      FROM review r
      JOIN work w ON w.id = r.work_id
      JOIN work sw ON sw.user_id = r.user_id
        AND sw.type = w.type
        AND sw.external_id = w.external_id
      WHERE r.watch_id IS NULL
        AND w.external_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM watch wa
          WHERE wa.user_id = r.user_id AND wa.work_id = sw.id
        )
      ORDER BY r.user_id, sw.id, r.created_date DESC
    `.execute(db);

    // 11c. Point the reviews at their watch.
    await sql`
      UPDATE review SET watch_id = wa.id
      FROM work w, work sw, watch wa
      WHERE review.work_id = w.id
        AND review.watch_id IS NULL
        AND w.external_id IS NOT NULL
        AND sw.user_id = review.user_id
        AND sw.type = w.type
        AND sw.external_id = w.external_id
        AND wa.user_id = review.user_id
        AND wa.work_id = sw.id
    `.execute(db);

    // 11d–f. Same three steps for manual works (external_id NULL), which have
    //        no cross-club identity — (type, title) stands in, so the same
    //        manually-added title in two clubs folds into one solo work.
    await sql`
      INSERT INTO work (user_id, title, type, image_url)
      SELECT DISTINCT ON (r.user_id, w.type, w.title)
        r.user_id, w.title, w.type, w.image_url
      FROM review r
      JOIN work w ON w.id = r.work_id
      WHERE r.watch_id IS NULL
        AND w.external_id IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM work sw
          WHERE sw.user_id = r.user_id
            AND sw.type = w.type
            AND sw.title = w.title
            AND sw.external_id IS NULL
        )
    `.execute(db);

    await sql`
      INSERT INTO watch (user_id, work_id, watched_date, score, created_date)
      SELECT DISTINCT ON (r.user_id, sw.id)
        r.user_id,
        sw.id,
        (min(r.created_date) OVER (PARTITION BY r.user_id, sw.id))::date,
        r.score,
        min(r.created_date) OVER (PARTITION BY r.user_id, sw.id)
      FROM review r
      JOIN work w ON w.id = r.work_id
      JOIN work sw ON sw.user_id = r.user_id
        AND sw.type = w.type
        AND sw.title = w.title
        AND sw.external_id IS NULL
      WHERE r.watch_id IS NULL
        AND w.external_id IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM watch wa
          WHERE wa.user_id = r.user_id AND wa.work_id = sw.id
        )
      ORDER BY r.user_id, sw.id, r.created_date DESC
    `.execute(db);

    await sql`
      UPDATE review SET watch_id = wa.id
      FROM work w, work sw, watch wa
      WHERE review.work_id = w.id
        AND review.watch_id IS NULL
        AND w.external_id IS NULL
        AND sw.user_id = review.user_id
        AND sw.type = w.type
        AND sw.title = w.title
        AND sw.external_id IS NULL
        AND wa.user_id = review.user_id
        AND wa.work_id = sw.id
    `.execute(db);
  }

  // 12. Every review now has a parent watch; deleting a watch with club
  //     reviews attached is blocked (RESTRICT) so club history can't be
  //     orphaned from the library.
  await sql`ALTER TABLE review ALTER COLUMN watch_id SET NOT NULL`.execute(db);
  if (!(await constraintExists(db, "fk_review_watch_id"))) {
    await db.schema
      .alterTable("review")
      .addForeignKeyConstraint("fk_review_watch_id", ["watch_id"], "watch", [
        "id",
      ])
      .onDelete("restrict")
      .execute();
  }

  // 13. The score now lives on the watch alone. Also drop the earlier draft's
  //     per-review solo columns if this database ran it (no-ops elsewhere).
  await sql`ALTER TABLE review DROP COLUMN IF EXISTS score`.execute(db);
  await sql`ALTER TABLE review DROP COLUMN IF EXISTS watched_date`.execute(db);
  await sql`ALTER TABLE review DROP COLUMN IF EXISTS rewatch`.execute(db);
  await sql`ALTER TABLE review DROP COLUMN IF EXISTS source`.execute(db);
  await sql`ALTER TABLE review DROP COLUMN IF EXISTS source_ref`.execute(db);
  await sql`ALTER TABLE review DROP COLUMN IF EXISTS text`.execute(db);
}

export async function down(db: Kysely<unknown>) {
  // Best-effort, destructive rollback for local development, in reverse order.
  // Scores are restored onto review rows from their watch; a review whose
  // watch has no score cannot exist in the old NOT NULL shape and is deleted.

  await sql`ALTER TABLE review ADD COLUMN IF NOT EXISTS score DECIMAL`.execute(
    db,
  );
  if (await columnExists(db, "review", "watch_id")) {
    await sql`
      UPDATE review SET score = wa.score
      FROM watch wa
      WHERE wa.id = review.watch_id AND review.score IS NULL
    `.execute(db);
  }
  await sql`DELETE FROM review WHERE score IS NULL`.execute(db);
  await sql`ALTER TABLE review ALTER COLUMN score SET NOT NULL`.execute(db);

  if (await constraintExists(db, "fk_review_watch_id")) {
    await sql`ALTER TABLE review DROP CONSTRAINT fk_review_watch_id`.execute(
      db,
    );
  }
  await db.schema.dropIndex("idx_review_watch_id").ifExists().execute();
  await sql`ALTER TABLE review DROP COLUMN IF EXISTS watch_id`.execute(db);
  await db.schema.dropTable("watch").ifExists().execute();

  // Drop the solo indexes (CASCADE per crdb #42840 for the unique ones).
  await sql`DROP INDEX IF EXISTS uq_work_user_type_external_id CASCADE`.execute(
    db,
  );
  await sql`DROP INDEX IF EXISTS uq_work_list_user_system_type CASCADE`.execute(
    db,
  );
  await db.schema
    .dropIndex("idx_work_list_user_id_position")
    .ifExists()
    .execute();

  // Drop the XOR CHECKs and solo FKs if present.
  if (await constraintExists(db, "chk_work_owner")) {
    await sql`ALTER TABLE work DROP CONSTRAINT chk_work_owner`.execute(db);
  }
  if (await constraintExists(db, "chk_work_list_owner")) {
    await sql`ALTER TABLE work_list DROP CONSTRAINT chk_work_list_owner`.execute(
      db,
    );
  }
  if (await constraintExists(db, "fk_work_user_id")) {
    await sql`ALTER TABLE work DROP CONSTRAINT fk_work_user_id`.execute(db);
  }
  if (await constraintExists(db, "fk_work_list_user_id")) {
    await sql`ALTER TABLE work_list DROP CONSTRAINT fk_work_list_user_id`.execute(
      db,
    );
  }

  // Delete solo rows (they have nowhere to live in the old NOT NULL club_id
  // shape), then drop the solo user_id columns and restore club_id NOT NULL.
  await sql`DELETE FROM work_list WHERE user_id IS NOT NULL`.execute(db);
  await sql`DELETE FROM work WHERE user_id IS NOT NULL`.execute(db);
  await sql`ALTER TABLE work DROP COLUMN IF EXISTS user_id`.execute(db);
  await sql`ALTER TABLE work_list DROP COLUMN IF EXISTS user_id`.execute(db);
  await sql`ALTER TABLE work ALTER COLUMN club_id SET NOT NULL`.execute(db);
  await sql`ALTER TABLE work_list ALTER COLUMN club_id SET NOT NULL`.execute(
    db,
  );
}
