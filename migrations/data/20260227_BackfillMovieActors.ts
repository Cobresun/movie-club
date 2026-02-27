import axios from "axios";

import { db } from "../../netlify/functions/utils/database";

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

async function fetchActors(
  externalId: string,
): Promise<{ name: string; order: number }[]> {
  const tmdbApiKey = process.env.TMDB_API_KEY;
  const response = await axios.get<TMDBCreditsResponse>(
    `https://api.themoviedb.org/3/movie/${externalId}/credits?api_key=${tmdbApiKey}`,
  );
  return response.data.cast
    .sort((a, b) => a.order - b.order)
    .map((c) => ({ name: c.name, order: c.order }));
}

const backfillMovieActors = async () => {
  // Get all movie_details entries that don't have corresponding movie_actors rows
  const movies = await db
    .selectFrom("movie_details")
    .leftJoin(
      "movie_actors",
      "movie_actors.external_id",
      "movie_details.external_id",
    )
    .where("movie_actors.actor_name", "is", null)
    .select(["movie_details.external_id", "movie_details.title"])
    .execute();

  console.log(`Found ${movies.length} movies without actor data`);
  let processed = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < movies.length; i += BATCH_SIZE) {
    const batch = movies.slice(i, i + BATCH_SIZE);

    for (const movie of batch) {
      try {
        const actors = await fetchActors(movie.external_id);

        if (actors.length > 0) {
          await db
            .insertInto("movie_actors")
            .values(
              actors.map((actor) => ({
                external_id: movie.external_id,
                actor_name: actor.name,
                cast_order: actor.order,
              })),
            )
            .onConflict((oc) =>
              oc.columns(["external_id", "actor_name"]).doNothing(),
            )
            .execute();
          processed++;
          console.log(
            `Processed: ${movie.title ?? movie.external_id} — ${actors.length} actors`,
          );
        } else {
          skipped++;
          console.log(
            `Skipped (no actors found): ${movie.title ?? movie.external_id}`,
          );
        }
      } catch (error) {
        console.error(
          `Error processing ${movie.title ?? movie.external_id}:`,
          error,
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
  console.log(`Skipped (no actors): ${skipped}`);
  console.log(`Errors: ${errors}`);
};

backfillMovieActors()
  .then(() => console.log("Movie actors backfill completed"))
  .catch(console.error);
