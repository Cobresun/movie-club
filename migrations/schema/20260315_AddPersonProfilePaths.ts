import { Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>) {
  await sql`ALTER TABLE movie_actors ADD COLUMN IF NOT EXISTS profile_path VARCHAR`.execute(
    db,
  );

  await sql`ALTER TABLE movie_directors ADD COLUMN IF NOT EXISTS director_id INT8`.execute(
    db,
  );
  await sql`ALTER TABLE movie_directors ADD COLUMN IF NOT EXISTS profile_path VARCHAR`.execute(
    db,
  );
}

export async function down(db: Kysely<unknown>) {
  await sql`ALTER TABLE movie_directors DROP COLUMN IF EXISTS profile_path`.execute(
    db,
  );
  await sql`ALTER TABLE movie_directors DROP COLUMN IF EXISTS director_id`.execute(
    db,
  );
  await sql`ALTER TABLE movie_actors DROP COLUMN IF EXISTS profile_path`.execute(
    db,
  );
}
