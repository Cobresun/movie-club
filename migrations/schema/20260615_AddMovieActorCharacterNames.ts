import axios from "axios";
import { Kysely, sql } from "kysely";

interface TMDBCastMember {
  id: number;
  name: string;
  character: string;
  order: number;
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

export async function up(db: Kysely<unknown>) {
  await sql`ALTER TABLE movie_actors ADD COLUMN IF NOT EXISTS character_name VARCHAR`.execute(
    db,
  );

  // Backfill character names for movies whose actor rows predate this column.
  // Mirrors 20260315_AddPersonProfilePaths.ts: batch TMDB credits requests
  // (40 req/10s limit) and bulk-UPDATE on the (external_id, actor_id) key.
  const { rows: movies } = await sql<MovieRow>`
      SELECT DISTINCT md.external_id, md.title
      FROM movie_details md
      INNER JOIN movie_actors ma ON ma.external_id = md.external_id
      WHERE ma.character_name IS NULL
    `.execute(db);

  console.log(`Found ${movies.length} movies needing character name backfill`);
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
      character: string;
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
          character: castMember.character,
        });
      }

      processed++;
      console.log(`Processed: ${movie.title ?? movie.external_id}`);
    }

    // Bulk UPDATE actors
    if (actorUpdates.length > 0) {
      const values = sql.join(
        actorUpdates.map(
          (u) =>
            sql`(${u.externalId}::VARCHAR, ${u.actorId}::INT8, ${u.character}::VARCHAR)`,
        ),
      );
      await sql`
          UPDATE movie_actors AS ma
          SET character_name = v.character_name
          FROM (VALUES ${values}) AS v(external_id, actor_id, character_name)
          WHERE ma.external_id = v.external_id
            AND ma.actor_id = v.actor_id
        `.execute(db);
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
}

export async function down(db: Kysely<unknown>) {
  await sql`ALTER TABLE movie_actors DROP COLUMN IF EXISTS character_name`.execute(
    db,
  );
}
