import { Kysely, Transaction } from "kysely";

import { DB } from "../../../lib/types/generated/db";
import { TMDBMovieData } from "../../../lib/types/movie";

/**
 * Insert movie details and related data into the database
 * Used when adding a new movie to the database
 */
export async function insertMovieDetails(
  externalId: string,
  tmdbData: TMDBMovieData,
  dbOrTrx: Kysely<DB> | Transaction<DB>,
) {
  // Insert movie details
  await dbOrTrx
    .insertInto("movie_details")
    .values({
      external_id: externalId,
      tmdb_score: tmdbData.vote_average,
      runtime: tmdbData.runtime,
      budget: tmdbData.budget,
      revenue: tmdbData.revenue,
      release_date: tmdbData.release_date
        ? new Date(tmdbData.release_date)
        : null,
      adult: tmdbData.adult,
      backdrop_path: tmdbData.backdrop_path,
      homepage: tmdbData.homepage,
      imdb_id: tmdbData.imdb_id,
      original_language: tmdbData.original_language,
      original_title: tmdbData.original_title,
      overview: tmdbData.overview,
      popularity: tmdbData.popularity,
      poster_path: tmdbData.poster_path,
      status: tmdbData.status,
      tagline: tmdbData.tagline,
      title: tmdbData.title,
    })
    .onConflict((oc) => oc.column("external_id").doNothing())
    .execute();

  // Insert genres
  if (tmdbData.genres.length > 0) {
    await dbOrTrx
      .insertInto("movie_genres")
      .values(
        tmdbData.genres.map((g) => ({
          external_id: externalId,
          genre_name: g.name,
        })),
      )
      .onConflict((oc) => oc.columns(["external_id", "genre_name"]).doNothing())
      .execute();
  }

  // Insert production companies
  if (tmdbData.production_companies.length > 0) {
    await dbOrTrx
      .insertInto("movie_production_companies")
      .values(
        tmdbData.production_companies.map((c) => ({
          external_id: externalId,
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

  // Insert production countries
  if (tmdbData.production_countries.length > 0) {
    await dbOrTrx
      .insertInto("movie_production_countries")
      .values(
        tmdbData.production_countries.map((c) => ({
          external_id: externalId,
          country_code: c.iso_3166_1,
          country_name: c.name,
        })),
      )
      .onConflict((oc) =>
        oc.columns(["external_id", "country_code"]).doNothing(),
      )
      .execute();
  }

  // Insert directors
  const directors = (tmdbData.credits?.crew ?? [])
    .filter((c) => c.job === "Director")
    .map((c) => c.name);
  if (directors.length > 0) {
    await dbOrTrx
      .insertInto("movie_directors")
      .values(
        directors.map((name) => ({
          external_id: externalId,
          director_name: name,
        })),
      )
      .onConflict((oc) =>
        oc.columns(["external_id", "director_name"]).doNothing(),
      )
      .execute();
  }
}

/**
 * Update movie details and related data in the database
 * Used when refreshing existing movie data from TMDB
 * Deletes and re-inserts related data to handle removals
 */
export async function updateMovieDetails(
  externalId: string,
  tmdbData: TMDBMovieData,
  dbOrTrx: Kysely<DB> | Transaction<DB>,
) {
  // Update main movie_details table
  await dbOrTrx
    .updateTable("movie_details")
    .set({
      tmdb_score: tmdbData.vote_average,
      runtime: tmdbData.runtime,
      budget: tmdbData.budget,
      revenue: tmdbData.revenue,
      release_date: tmdbData.release_date
        ? new Date(tmdbData.release_date)
        : null,
      adult: tmdbData.adult,
      backdrop_path: tmdbData.backdrop_path,
      homepage: tmdbData.homepage,
      imdb_id: tmdbData.imdb_id,
      original_language: tmdbData.original_language,
      original_title: tmdbData.original_title,
      overview: tmdbData.overview,
      popularity: tmdbData.popularity,
      poster_path: tmdbData.poster_path,
      status: tmdbData.status,
      tagline: tmdbData.tagline,
      title: tmdbData.title,
      updated_date: new Date(),
    })
    .where("external_id", "=", externalId)
    .execute();

  // Update genres - delete old and insert new
  await dbOrTrx
    .deleteFrom("movie_genres")
    .where("external_id", "=", externalId)
    .execute();

  if (tmdbData.genres.length > 0) {
    await dbOrTrx
      .insertInto("movie_genres")
      .values(
        tmdbData.genres.map((g) => ({
          external_id: externalId,
          genre_name: g.name,
        })),
      )
      .execute();
  }

  // Update directors - delete old and insert new
  await dbOrTrx
    .deleteFrom("movie_directors")
    .where("external_id", "=", externalId)
    .execute();

  const directors = (tmdbData.credits?.crew ?? [])
    .filter((c) => c.job === "Director")
    .map((c) => c.name);

  if (directors.length > 0) {
    await dbOrTrx
      .insertInto("movie_directors")
      .values(
        directors.map((name) => ({
          external_id: externalId,
          director_name: name,
        })),
      )
      .execute();
  }

  // Update production companies - delete old and insert new
  await dbOrTrx
    .deleteFrom("movie_production_companies")
    .where("external_id", "=", externalId)
    .execute();

  if (tmdbData.production_companies.length > 0) {
    const uniqueCompanies = Array.from(
      new Map(tmdbData.production_companies.map((c) => [c.name, c])).values(),
    );
    await dbOrTrx
      .insertInto("movie_production_companies")
      .values(
        uniqueCompanies.map((c) => ({
          external_id: externalId,
          company_name: c.name,
          logo_path: c.logo_path,
          origin_country: c.origin_country,
        })),
      )
      .execute();
  }

  // Update production countries - delete old and insert new
  await dbOrTrx
    .deleteFrom("movie_production_countries")
    .where("external_id", "=", externalId)
    .execute();

  if (tmdbData.production_countries.length > 0) {
    await dbOrTrx
      .insertInto("movie_production_countries")
      .values(
        tmdbData.production_countries.map((c) => ({
          external_id: externalId,
          country_code: c.iso_3166_1,
          country_name: c.name,
        })),
      )
      .execute();
  }
}
