import axios from "axios";
import { Kysely, sql } from "kysely";

interface TMDBCastMember {
  id: number;
  order: number;
  popularity: number;
}

interface TMDBCreditsResponse {
  id: number;
  cast: TMDBCastMember[];
}

const BATCH_SIZE = 40;
const BATCH_DELAY_MS = 1000;

async function fetchCredits(externalId: string): Promise<TMDBCreditsResponse> {
  const tmdbApiKey = process.env.TMDB_API_KEY;
  const response = await axios.get<TMDBCreditsResponse>(
    `https://api.themoviedb.org/3/movie/${externalId}/credits?api_key=${tmdbApiKey}`,
  );
  return response.data;
}

/**
 * Snapshot of just the columns this backfill reads/writes, so the SELECT and
 * UPDATE below are type-checked against the schema rather than stringly-typed
 * SQL. The migration handle is `Kysely<unknown>`, so `withTables` is how we
 * teach it about the tables (including the freshly added `popularity` column).
 */
type MigrationTables = {
  movie_details: { external_id: string; title: string | null };
  movie_actors: {
    external_id: string;
    actor_id: number;
    popularity: number | null;
  };
};

/**
 * Adds a per-actor `popularity` column to `movie_actors` and backfills it from
 * TMDB. The reviews-spotlight "Familiar face" fact uses it as a recognizability
 * signal so a genuinely famous actor billed just outside a large ensemble's
 * top-billed slice (e.g. Tom Holland in an Avengers movie) still counts as a
 * major presence. Mirrors the profile_path backfill in
 * 20260315_AddPersonProfilePaths.ts.
 */
export async function up(db: Kysely<unknown>) {
  // Kysely's addColumn can't express ADD COLUMN IF NOT EXISTS, which we rely on
  // for idempotent re-runs (CockroachDB has no transactional DDL, so a mid-run
  // failure leaves the column behind). Keep this one step as raw DDL; the data
  // queries below run through a typed handle.
  await sql`ALTER TABLE movie_actors ADD COLUMN IF NOT EXISTS popularity NUMERIC`.execute(
    db,
  );

  const typedDb = db.withTables<MigrationTables>();

  const movies = await typedDb
    .selectFrom("movie_details")
    .innerJoin(
      "movie_actors",
      "movie_actors.external_id",
      "movie_details.external_id",
    )
    .where("movie_actors.popularity", "is", null)
    .select(["movie_details.external_id", "movie_details.title"])
    .distinct()
    .execute();

  console.log(`Found ${movies.length} movies needing popularity backfill`);
  let processed = 0;
  let errors = 0;

  for (let i = 0; i < movies.length; i += BATCH_SIZE) {
    const batch = movies.slice(i, i + BATCH_SIZE);

    // Fetch all credits in parallel (TMDB allows 40 req/10s)
    const results = await Promise.allSettled(
      batch.map((movie) =>
        fetchCredits(movie.external_id).then((credits) => ({
          movie,
          credits,
        })),
      ),
    );

    const actorUpdates: {
      externalId: string;
      actorId: number;
      popularity: number;
    }[] = [];

    for (const result of results) {
      if (result.status === "rejected") {
        const message =
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason);
        console.error(`Error fetching credits: ${message}`);
        errors++;
        continue;
      }

      const { movie, credits } = result.value;

      for (const castMember of credits.cast) {
        actorUpdates.push({
          externalId: movie.external_id,
          actorId: castMember.id,
          popularity: castMember.popularity,
        });
      }

      processed++;
      console.log(`Processed: ${movie.title ?? movie.external_id}`);
    }

    // Type-safe per-row updates. Kysely can't express a bulk UPDATE ... FROM
    // (VALUES ...) with typed identifiers, so we issue one typed update per
    // actor and let the pg pool bound real concurrency. This is a one-time
    // backfill, so the extra round trips are acceptable.
    await Promise.all(
      actorUpdates.map((u) =>
        typedDb
          .updateTable("movie_actors")
          .set({ popularity: u.popularity })
          .where("external_id", "=", u.externalId)
          .where("actor_id", "=", u.actorId)
          .execute(),
      ),
    );

    // Delay between batches to respect TMDB rate limits
    if (i + BATCH_SIZE < movies.length) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
    }

    console.log(
      `Progress: ${Math.min(i + BATCH_SIZE, movies.length)}/${movies.length}`,
    );
  }

  console.log("\n=== Backfill Summary ===");
  console.log(`Total movies: ${movies.length}`);
  console.log(`Successfully processed: ${processed}`);
  console.log(`Errors: ${errors}`);
}

export async function down(db: Kysely<unknown>) {
  await sql`ALTER TABLE movie_actors DROP COLUMN IF EXISTS popularity`.execute(
    db,
  );
}
