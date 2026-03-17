import { CockroachDialect } from "@cubos/kysely-cockroach";
import axios from "axios";
import { Kysely, sql } from "kysely";
import { Pool } from "pg";

interface TMDBCastMember {
  id: number;
  name: string;
  order: number;
  profile_path: string | null;
}

interface TMDBCrewMember {
  id: number;
  name: string;
  job: string;
  profile_path: string | null;
}

interface TMDBCreditsResponse {
  id: number;
  cast: TMDBCastMember[];
  crew: TMDBCrewMember[];
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

interface MovieRow {
  external_id: string;
  title: string | null;
}

function createResilientDb(): Kysely<unknown> {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  // Prevent unhandled error events from crashing the process —
  // the pool will transparently create new connections as needed
  pool.on("error", (err) => {
    console.warn("Pool connection error (will reconnect):", err.message);
  });
  return new Kysely<unknown>({
    dialect: new CockroachDialect({ pool }),
  });
}

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

  // Use a separate resilient connection for the long-running backfill
  // to handle CockroachDB connection drops gracefully
  const backfillDb = createResilientDb();

  try {
    const { rows: movies } = await sql<MovieRow>`
      SELECT DISTINCT md.external_id, md.title
      FROM movie_details md
      INNER JOIN movie_actors ma ON ma.external_id = md.external_id
      WHERE ma.profile_path IS NULL
    `.execute(backfillDb);

    console.log(`Found ${movies.length} movies needing profile path backfill`);
    let processed = 0;
    let errors = 0;

    for (let i = 0; i < movies.length; i += BATCH_SIZE) {
      const batch = movies.slice(i, i + BATCH_SIZE);

      for (const movie of batch) {
        try {
          const credits = await fetchCredits(movie.external_id);

          // Update actors with profile_path
          for (const castMember of credits.cast) {
            await sql`
              UPDATE movie_actors
              SET profile_path = ${castMember.profile_path}
              WHERE external_id = ${movie.external_id}
                AND actor_id = ${String(castMember.id)}
            `.execute(backfillDb);
          }

          // Update directors with director_id and profile_path
          const directors = credits.crew.filter((c) => c.job === "Director");
          for (const director of directors) {
            await sql`
              UPDATE movie_directors
              SET director_id = ${director.id}, profile_path = ${director.profile_path}
              WHERE external_id = ${movie.external_id}
                AND director_name = ${director.name}
            `.execute(backfillDb);
          }

          processed++;
          console.log(`Processed: ${movie.title ?? movie.external_id}`);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          console.error(
            `Error processing ${movie.title ?? movie.external_id}: ${message}`,
          );
          errors++;
        }
      }

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
  } finally {
    await backfillDb.destroy();
  }
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
