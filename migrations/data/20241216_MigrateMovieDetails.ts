import { db } from "../../netlify/functions/utils/database";
import { getDetailedWorks } from "../../netlify/functions/utils/tmdb";

const BATCH_SIZE = 50; // Using the same batch size as getDetailedWorks

const populateMovieDetails = async () => {
  // Get all unique movies from the work table
  const movies = await db
    .selectFrom("work")
    .select(["external_id", "title", "type", "id"])
    .where("type", "=", "movie")
    .where("external_id", "is not", null)
    .distinct()
    .execute();

  // Convert to Work format
  const workItems = movies.map((movie) => ({
    id: movie.id,
    title: movie.title,
    type: movie.type,
    externalId: movie.external_id!,
    createdDate: new Date().toISOString(),
  }));

  console.log(`Found ${workItems.length} unique movies to process`);
  let processed = 0;
  let skipped = 0;
  let errors = 0;

  // Process movies in batches
  for (let i = 0; i < workItems.length; i += BATCH_SIZE) {
    const batch = workItems.slice(i, i + BATCH_SIZE);

    // Filter out movies that already have details
    const existingDetails = await db
      .selectFrom("movie_details")
      .select("external_id")
      .where(
        "external_id",
        "in",
        batch.map((m) => parseInt(m.externalId)),
      )
      .execute();

    const existingIds = new Set(
      existingDetails.map((d) => d.external_id.toString()),
    );
    const moviesToProcess = batch.filter((m) => !existingIds.has(m.externalId));

    if (moviesToProcess.length === 0) {
      skipped += batch.length;
      continue;
    }

    try {
      // Fetch movie details using existing function
      const moviesWithDetails = await getDetailedWorks(moviesToProcess);

      // Process each movie in the batch
      for (const movie of moviesWithDetails) {
        if (!movie.externalData) continue;

        try {
          // Insert into movie_details table and get the inserted ID
          const [insertedMovie] = await db
            .insertInto("movie_details")
            .values({
              external_id: parseInt(movie.externalId),
              tmdb_score: movie.externalData.vote_average,
              runtime: movie.externalData.runtime,
              budget: movie.externalData.budget,
              revenue: movie.externalData.revenue,
              release_date: movie.externalData.release_date
                ? new Date(movie.externalData.release_date)
                : null,
              adult: movie.externalData.adult,
              backdrop_path: movie.externalData.backdrop_path,
              homepage: movie.externalData.homepage,
              imdb_id: movie.externalData.imdb_id,
              original_language: movie.externalData.original_language,
              original_title: movie.externalData.original_title,
              overview: movie.externalData.overview,
              popularity: movie.externalData.popularity,
              poster_path: movie.externalData.poster_path,
              status: movie.externalData.status,
              tagline: movie.externalData.tagline,
              title: movie.externalData.title,
            })
            .returning("id")
            .execute();

          // Process genres
          if (movie.externalData.genres.length > 0) {
            await db
              .insertInto("movie_genres")
              .values(
                movie.externalData.genres.map((g) => ({
                  external_id: movie.externalId,
                  genre_name: g.name,
                })),
              )
              .onConflict((oc) =>
                oc.columns(["external_id", "genre_name"]).doNothing(),
              )
              .execute();
          }

          // Process production companies
          if (movie.externalData.production_companies.length > 0) {
            await db
              .insertInto("movie_production_companies")
              .values(
                movie.externalData.production_companies.map((c) => ({
                  external_id: movie.externalId,
                  company_name: c.name,
                  logo_path: c.logo_path,
                  origin_country: c.origin_country,
                })),
              )
              .onConflict((oc) =>
                oc.columns(["external_id", "company_name"]).doNothing(),
              )
              .execute();
          }

          // Process production countries
          if (movie.externalData.production_countries.length > 0) {
            await db
              .insertInto("movie_production_countries")
              .values(
                movie.externalData.production_countries.map((c) => ({
                  external_id: movie.externalId,
                  country_code: c.iso_3166_1,
                  country_name: c.name,
                })),
              )
              .onConflict((oc) =>
                oc.columns(["external_id", "country_code"]).doNothing(),
              )
              .execute();
          }

          processed++;
          console.log(`Successfully processed: ${movie.title}`);
        } catch (error) {
          console.error(`Error processing movie ${movie.title}:`, error);
          errors++;
        }
      }

      // Add a small delay between batches to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 250));
    } catch (error) {
      console.error(`Error processing batch:`, error);
      errors += moviesToProcess.length;
    }
    console.log(`Processed ${processed} movies`);
  }

  console.log("\n=== Migration Summary ===");
  console.log(`Total movies: ${workItems.length}`);
  console.log(`Successfully processed: ${processed}`);
  console.log(`Skipped (already existed): ${skipped}`);
  console.log(`Errors: ${errors}`);
};

populateMovieDetails().then(() =>
  console.log("Movie details population completed"),
);
