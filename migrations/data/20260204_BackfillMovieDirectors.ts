import axios from "axios";

import { db } from "../../netlify/functions/utils/database";

interface TMDBCrewMember {
  id: number;
  name: string;
  job: string;
  department: string;
}

interface TMDBCreditsResponse {
  id: number;
  crew: TMDBCrewMember[];
}

const BATCH_SIZE = 40;
const BATCH_DELAY_MS = 1000;

async function fetchDirectors(externalId: string): Promise<string[]> {
  const tmdbApiKey = process.env.TMDB_API_KEY;
  const response = await axios.get<TMDBCreditsResponse>(
    `https://api.themoviedb.org/3/movie/${externalId}/credits?api_key=${tmdbApiKey}`,
  );
  return response.data.crew
    .filter((c) => c.job === "Director")
    .map((c) => c.name);
}

const backfillMovieDirectors = async () => {
  // Get all movie_details entries that don't have corresponding movie_directors rows
  const movies = await db
    .selectFrom("movie_details")
    .leftJoin(
      "movie_directors",
      "movie_directors.external_id",
      "movie_details.external_id",
    )
    .where("movie_directors.director_name", "is", null)
    .select(["movie_details.external_id", "movie_details.title"])
    .execute();

  console.log(`Found ${movies.length} movies without director data`);
  let processed = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < movies.length; i += BATCH_SIZE) {
    const batch = movies.slice(i, i + BATCH_SIZE);

    for (const movie of batch) {
      try {
        const directors = await fetchDirectors(movie.external_id);

        if (directors.length > 0) {
          await db
            .insertInto("movie_directors")
            .values(
              directors.map((name) => ({
                external_id: movie.external_id,
                director_name: name,
              })),
            )
            .onConflict((oc) =>
              oc.columns(["external_id", "director_name"]).doNothing(),
            )
            .execute();
          processed++;
          console.log(
            `Processed: ${movie.title ?? movie.external_id} — ${directors.join(", ")}`,
          );
        } else {
          skipped++;
          console.log(
            `Skipped (no directors found): ${movie.title ?? movie.external_id}`,
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
  console.log(`Skipped (no directors): ${skipped}`);
  console.log(`Errors: ${errors}`);
};

backfillMovieDirectors()
  .then(() => console.log("Movie directors backfill completed"))
  .catch(console.error);
