import { Kysely, sql } from "kysely";

// Solo Spaces (Milestone 1) — lets a `work` / `work_list` / `review` belong to
// an individual user ("solo") instead of a club. Ownership becomes an XOR:
// every work_list and work row is owned by EXACTLY ONE of club_id / user_id.
//
// Existing rows all have (club_id set, user_id null) and satisfy the new XOR
// CHECK unchanged, so no backfill is required. Solo reviews lists are created
// lazily by the repository write path (Workstream B) — this migration creates
// no lists.
//
// CockroachDB has NO transactional DDL: a migration that errors midway leaves
// the created columns/constraints/indexes in place. Every step below is
// therefore idempotent (IF NOT EXISTS / DROP NOT NULL no-ops / constraint
// guards) so a partial failure can simply be re-run.

// CRDB cannot express "ADD CONSTRAINT IF NOT EXISTS" for CHECK/FK constraints,
// so we guard by looking the constraint up in the catalog by name.
async function constraintExists(db: Kysely<unknown>, name: string) {
  const row = await sql<{ c: number }>`
    SELECT count(*)::int AS c FROM pg_catalog.pg_constraint WHERE conname = ${name}
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

  // 9. review changes.
  //    - score DROP NOT NULL: solo "log a watch" events may be unrated. Club
  //      endpoints still require a score at the app layer. DROP NOT NULL is a
  //      no-op if already nullable.
  await sql`ALTER TABLE review ALTER COLUMN score DROP NOT NULL`.execute(db);
  //    - watched_date: the diary date a solo event happened (null = undated /
  //      club events fall back to created_date at query time).
  await sql`ALTER TABLE review ADD COLUMN IF NOT EXISTS watched_date DATE`.execute(
    db,
  );
  //    - rewatch: whether this event was a rewatch. NOT NULL DEFAULT false —
  //      existing/club rows default to false.
  await sql`ALTER TABLE review ADD COLUMN IF NOT EXISTS rewatch BOOLEAN NOT NULL DEFAULT false`.execute(
    db,
  );
  //    - source / source_ref: provenance for imported events (e.g. Letterboxd).
  //      No unique index on source_ref in M1 — dedupe-on-import is an M3
  //      concern; this only reserves the columns.
  await sql`ALTER TABLE review ADD COLUMN IF NOT EXISTS source VARCHAR`.execute(
    db,
  );
  await sql`ALTER TABLE review ADD COLUMN IF NOT EXISTS source_ref VARCHAR`.execute(
    db,
  );
  //    - text: per-event private solo note. work_comment can't host this (it's
  //      club-scoped and shared), so text lives on the review row. Club events
  //      leave it null.
  await sql`ALTER TABLE review ADD COLUMN IF NOT EXISTS text VARCHAR`.execute(
    db,
  );

  // 10. No backfill.
}

export async function down(db: Kysely<unknown>) {
  // Best-effort, destructive rollback for local development, in reverse order.
  // Solo rows have nowhere to live in the old (NOT NULL club_id) shape, so they
  // are deleted before the NOT NULL constraints are restored.

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

  // Delete solo rows (reviews cascade from work_list_item / user FKs; here we
  // clear the owning work_list and work rows explicitly).
  await sql`DELETE FROM work_list WHERE user_id IS NOT NULL`.execute(db);
  await sql`DELETE FROM work WHERE user_id IS NOT NULL`.execute(db);

  // Drop the review columns, then restore score NOT NULL.
  await sql`ALTER TABLE review DROP COLUMN IF EXISTS text`.execute(db);
  await sql`ALTER TABLE review DROP COLUMN IF EXISTS source_ref`.execute(db);
  await sql`ALTER TABLE review DROP COLUMN IF EXISTS source`.execute(db);
  await sql`ALTER TABLE review DROP COLUMN IF EXISTS rewatch`.execute(db);
  await sql`ALTER TABLE review DROP COLUMN IF EXISTS watched_date`.execute(db);
  await sql`ALTER TABLE review ALTER COLUMN score SET NOT NULL`.execute(db);

  // Drop the solo user_id columns, then restore club_id NOT NULL on both.
  await sql`ALTER TABLE work DROP COLUMN IF EXISTS user_id`.execute(db);
  await sql`ALTER TABLE work_list DROP COLUMN IF EXISTS user_id`.execute(db);
  await sql`ALTER TABLE work ALTER COLUMN club_id SET NOT NULL`.execute(db);
  await sql`ALTER TABLE work_list ALTER COLUMN club_id SET NOT NULL`.execute(
    db,
  );
}
