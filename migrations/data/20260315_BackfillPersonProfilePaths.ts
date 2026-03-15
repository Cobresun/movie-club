import axios from "axios";

import { db } from "../../netlify/functions/utils/database";

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

const backfillPersonProfilePaths = async () => {
  // Get all external_ids that have actors without profile_path populated
  const movies = await db
    .selectFrom("movie_details")
    .innerJoin(
      "movie_actors",
      "movie_actors.external_id",
      "movie_details.external_id",
    )
    .where("movie_actors.profile_path", "is", null)
    .select(["movie_details.external_id", "movie_details.title"])
    .distinct()
    .execute();

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
          await db
            .updateTable("movie_actors")
            .set({ profile_path: castMember.profile_path })
            .where("external_id", "=", movie.external_id)
            .where("actor_id", "=", castMember.id)
            .execute();
        }

        // Update directors with director_id and profile_path
        const directors = credits.crew.filter((c) => c.job === "Director");
        for (const director of directors) {
          await db
            .updateTable("movie_directors")
            .set({
              director_id: director.id,
              profile_path: director.profile_path,
            })
            .where("external_id", "=", movie.external_id)
            .where("director_name", "=", director.name)
            .execute();
        }

        processed++;
        console.log(`Processed: ${movie.title ?? movie.external_id}`);
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
  console.log(`Errors: ${errors}`);
};

backfillPersonProfilePaths()
  .then(() => console.log("Person profile paths backfill completed"))
  .catch(console.error);
