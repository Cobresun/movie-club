import { db } from "../utils/database";
import { getDetailedWorks } from "../utils/tmdb";

import { WorkType } from "@/common/types/generated/db";
import { ListInsertDto } from "@/common/types/lists";

class WorkRepository {
  async findByType(clubId: string, type: WorkType, externalId: string) {
    return db
      .selectFrom("work")
      .where("club_id", "=", clubId)
      .where("external_id", "=", externalId)
      .where("type", "=", type)
      .select(["id"])
      .executeTakeFirst();
  }

  async getNextWork(clubId: string) {
    return db
      .selectFrom("next_work")
      .where("club_id", "=", clubId)
      .select(["work_id"])
      .executeTakeFirst();
  }

  async setNextWork(clubId: string, workId: string) {
    return db
      .insertInto("next_work")
      .values({ club_id: clubId, work_id: workId })
      .execute();
  }

  async deleteNextWork(clubId: string) {
    return db.deleteFrom("next_work").where("club_id", "=", clubId).execute();
  }

  async insert(clubId: string, work: ListInsertDto) {
    // First insert the work
    const insertedWork = await db
      .insertInto("work")
      .values({
        club_id: clubId,
        title: work.title,
        type: work.type,
        external_id: work.externalId,
        image_url: work.imageUrl,
      })
      .onConflict(
        (oc) =>
          oc
            .constraint("uq_club_id_type_external_id")
            .doUpdateSet({ club_id: clubId }) // This is a no-op, but required for the query to return the id
      )
      .returning("id")
      .executeTakeFirst();

    // If it's a movie with an external ID, fetch and store its details
    if (work.type === "movie" && work.externalId) {
      const [movieDetails] = await getDetailedWorks([{
        id: insertedWork!.id,
        title: work.title,
        type: work.type,
        externalId: work.externalId,
        createdDate: new Date().toISOString(),
      }]);

      if (movieDetails?.externalData) {
        // Insert movie details
        await db
          .insertInto("movie_details")
          .values({
            external_id: work.externalId,
            tmdb_score: movieDetails.externalData.vote_average,
            runtime: movieDetails.externalData.runtime,
            budget: movieDetails.externalData.budget,
            revenue: movieDetails.externalData.revenue,
            release_date: movieDetails.externalData.release_date
              ? new Date(movieDetails.externalData.release_date)
              : null,
            adult: movieDetails.externalData.adult,
            backdrop_path: movieDetails.externalData.backdrop_path,
            homepage: movieDetails.externalData.homepage,
            imdb_id: movieDetails.externalData.imdb_id,
            original_language: movieDetails.externalData.original_language,
            original_title: movieDetails.externalData.original_title,
            overview: movieDetails.externalData.overview,
            popularity: movieDetails.externalData.popularity,
            poster_path: movieDetails.externalData.poster_path,
            status: movieDetails.externalData.status,
            tagline: movieDetails.externalData.tagline,
            title: movieDetails.externalData.title,
          })
          .onConflict((oc) => 
            oc.column("external_id").doNothing()
          )
          .execute();

        // Insert genres
        if (movieDetails.externalData.genres.length > 0) {
          await db
            .insertInto("movie_genres")
            .values(
              movieDetails.externalData.genres.map((g) => ({
                external_id: work.externalId!,
                genre_name: g.name,
              }))
            )
            .onConflict((oc) => 
              oc.columns(["external_id", "genre_name"]).doNothing()
            )
            .execute();
        }

        // Insert production companies
        if (movieDetails.externalData.production_companies.length > 0) {
          await db
            .insertInto("movie_production_companies")
            .values(
              movieDetails.externalData.production_companies.map((c) => ({
                external_id: work.externalId!,
                company_name: c.name,
                logo_path: c.logo_path,
                origin_country: c.origin_country,
              }))
            )
            .onConflict((oc) => 
              oc.columns(["external_id", "company_name"]).doNothing()
            )
            .execute();
        }

        // Insert production countries
        if (movieDetails.externalData.production_countries.length > 0) {
          await db
            .insertInto("movie_production_countries")
            .values(
              movieDetails.externalData.production_countries.map((c) => ({
                external_id: work.externalId!,
                country_code: c.iso_3166_1,
                country_name: c.name,
              }))
            )
            .onConflict((oc) => 
              oc.columns(["external_id", "country_code"]).doNothing()
            )
            .execute();
        }
      }
    }

    return insertedWork;
  }

  async delete(clubId: string, workId: string) {
    return db
      .deleteFrom("work")
      .where("id", "=", workId)
      .where("club_id", "=", clubId)
      .execute();
  }
}

export function isWorkType(type: string): type is WorkType {
  return Object.values(WorkType).includes(type as WorkType);
}

export default new WorkRepository();
