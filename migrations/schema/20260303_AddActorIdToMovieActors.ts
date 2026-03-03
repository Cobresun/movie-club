import { Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>) {
  // Truncate existing data; it will be re-backfilled with actor IDs
  await sql`TRUNCATE TABLE movie_actors`.execute(db);

  // IF NOT EXISTS guards against partial re-runs
  await sql`ALTER TABLE movie_actors ADD COLUMN IF NOT EXISTS actor_id INT8 NOT NULL`.execute(
    db,
  );

  // CockroachDB implements unique constraints as indexes — must use DROP INDEX CASCADE.
  // IF EXISTS guards against partial re-runs where the drop already succeeded.
  await sql`DROP INDEX IF EXISTS movie_actors@movie_actors_unique CASCADE`.execute(
    db,
  );

  await db.schema
    .alterTable("movie_actors")
    .addUniqueConstraint("movie_actors_unique", ["external_id", "actor_id"])
    .execute();
}

export async function down(db: Kysely<unknown>) {
  await sql`TRUNCATE TABLE movie_actors`.execute(db);

  await sql`DROP INDEX IF EXISTS movie_actors@movie_actors_unique CASCADE`.execute(
    db,
  );

  await db.schema
    .alterTable("movie_actors")
    .addUniqueConstraint("movie_actors_unique", ["external_id", "actor_name"])
    .execute();

  await db.schema.alterTable("movie_actors").dropColumn("actor_id").execute();
}
