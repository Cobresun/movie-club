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

interface MovieRow {
  external_id: string;
  title: string | null;
}

/**
 * Adds a per-actor `popularity` column to `movie_actors` and backfills it from
 * TMDB. The reviews-spotlight "Familiar face" fact uses it as a recognizability
 * signal so a genuinely famous actor billed just outside a large ensemble's
 * top-billed slice (e.g. Tom Holland in an Avengers movie) still counts as a
 * major presence. Mirrors the profile_path backfill in
 * 20260315_AddPersonProfilePaths.ts.
 */
export async function up(db: Kysely<unknown>) {
  await sql`ALTER TABLE movie_actors ADD COLUMN IF NOT EXISTS popularity NUMERIC`.execute(db);

  const { rows: movies } = await sql<MovieRow>`
      SELECT DISTINCT md.external_id, md.title
      FROM movie_details md
      INNER JOIN movie_actors ma ON ma.external_id = md.external_id
      WHERE ma.popularity IS NULL
    `.execute(db);

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
          result.reason instanceof Error ? result.reason.message : String(result.reason);
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

    // Bulk UPDATE actor popularity
    if (actorUpdates.length > 0) {
      const values = sql.join(
        actorUpdates.map(
          (u) => sql`(${u.externalId}::VARCHAR, ${u.actorId}::INT8, ${u.popularity}::NUMERIC)`,
        ),
      );
      await sql`
          UPDATE movie_actors AS ma
          SET popularity = v.popularity
          FROM (VALUES ${values}) AS v(external_id, actor_id, popularity)
          WHERE ma.external_id = v.external_id
            AND ma.actor_id = v.actor_id
        `.execute(db);
    }

    // Delay between batches to respect TMDB rate limits
    if (i + BATCH_SIZE < movies.length) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
    }

    console.log(`Progress: ${Math.min(i + BATCH_SIZE, movies.length)}/${movies.length}`);
  }

  console.log("\n=== Backfill Summary ===");
  console.log(`Total movies: ${movies.length}`);
  console.log(`Successfully processed: ${processed}`);
  console.log(`Errors: ${errors}`);
}

export async function down(db: Kysely<unknown>) {
  await sql`ALTER TABLE movie_actors DROP COLUMN IF EXISTS popularity`.execute(db);
}
