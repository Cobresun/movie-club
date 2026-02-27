import { sql } from "kysely";

import { WorkListType } from "../../../lib/types/generated/db";
import { db } from "../utils/database";

class ReviewRepository {
  async getReviewList(clubId: string) {
    return db
      .with("genres_agg", (qb) =>
        qb
          .selectFrom("movie_genres")
          .select([
            "external_id",
            db.fn.agg<string[]>("array_agg", ["genre_name"]).as("genres"),
          ])
          .groupBy("external_id"),
      )
      .with("companies_agg", (qb) =>
        qb
          .selectFrom("movie_production_companies")
          .select([
            "external_id",
            db.fn
              .agg<string[]>("array_agg", ["company_name"])
              .as("production_companies"),
          ])
          .groupBy("external_id"),
      )
      .with("countries_agg", (qb) =>
        qb
          .selectFrom("movie_production_countries")
          .select([
            "external_id",
            db.fn
              .agg<string[]>("array_agg", ["country_name"])
              .as("production_countries"),
          ])
          .groupBy("external_id"),
      )
      .with("directors_agg", (qb) =>
        qb
          .selectFrom("movie_directors")
          .select([
            "external_id",
            db.fn.agg<string[]>("array_agg", ["director_name"]).as("directors"),
          ])
          .groupBy("external_id"),
      )
      .with("actors_agg", (qb) =>
        qb
          .selectFrom("movie_actors")
          .select([
            "external_id",
            sql<string[]>`array_agg(actor_name ORDER BY cast_order)`.as(
              "actors",
            ),
          ])
          .groupBy("external_id"),
      )
      .selectFrom("work_list")
      .where("work_list.club_id", "=", clubId)
      .where("work_list.type", "=", WorkListType.reviews)
      .innerJoin("work_list_item", "work_list_item.list_id", "work_list.id")
      .innerJoin("work", "work.id", "work_list_item.work_id")
      .leftJoin("review", "review.work_id", "work.id")
      .leftJoin(
        "movie_details",
        "movie_details.external_id",
        "work.external_id",
      )
      .leftJoin(
        "genres_agg",
        "genres_agg.external_id",
        "movie_details.external_id",
      )
      .leftJoin(
        "companies_agg",
        "companies_agg.external_id",
        "movie_details.external_id",
      )
      .leftJoin(
        "countries_agg",
        "countries_agg.external_id",
        "movie_details.external_id",
      )
      .leftJoin(
        "directors_agg",
        "directors_agg.external_id",
        "movie_details.external_id",
      )
      .leftJoin(
        "actors_agg",
        "actors_agg.external_id",
        "movie_details.external_id",
      )
      .select([
        "review.id as review_id",
        "work.id",
        "work.title",
        "work.type",
        "work.image_url",
        "work.external_id",
        "work_list_item.time_added",
        "review.score",
        "review.user_id",
        "movie_details.tmdb_score",
        "movie_details.runtime",
        "movie_details.budget",
        "movie_details.revenue",
        "movie_details.release_date",
        "movie_details.adult",
        "movie_details.backdrop_path",
        "movie_details.homepage",
        "movie_details.imdb_id",
        "movie_details.original_language",
        "movie_details.original_title",
        "movie_details.overview",
        "movie_details.popularity",
        "movie_details.poster_path",
        "movie_details.status",
        "movie_details.tagline",
        "genres_agg.genres",
        "companies_agg.production_companies",
        "countries_agg.production_countries",
        "directors_agg.directors",
        "actors_agg.actors",
      ])
      .groupBy([
        "review.id",
        "work.id",
        "work_list_item.time_added",
        "movie_details.external_id",
        "genres_agg.genres",
        "companies_agg.production_companies",
        "countries_agg.production_countries",
        "directors_agg.directors",
        "actors_agg.actors",
      ])
      .execute();
  }

  async insertReview(
    clubId: string,
    workId: string,
    userId: string,
    score: number,
  ) {
    const listId = await db
      .selectFrom("work_list")
      .select("id")
      .where("club_id", "=", clubId)
      .where("type", "=", WorkListType.reviews)
      .executeTakeFirstOrThrow();
    return db
      .insertInto("review")
      .values({
        list_id: listId.id,
        work_id: workId,
        user_id: userId,
        score,
      })
      .execute();
  }

  async getById(id: string, clubId: string) {
    return db
      .selectFrom("review")
      .selectAll()
      .innerJoin("work_list", "work_list.id", "review.list_id")
      .where("work_list.club_id", "=", clubId)
      .where("review.id", "=", id)
      .executeTakeFirstOrThrow();
  }

  async updateScore(id: string, score: number) {
    return db
      .updateTable("review")
      .set("score", score)
      .set("created_date", new Date())
      .where("id", "=", id)
      .execute();
  }

  async getReviewsByWorkId(clubId: string, workId: string) {
    return db
      .selectFrom("work_list")
      .where("work_list.club_id", "=", clubId)
      .where("work_list.type", "=", WorkListType.reviews)
      .innerJoin("work_list_item", "work_list_item.list_id", "work_list.id")
      .innerJoin("work", "work.id", "work_list_item.work_id")
      .where("work.id", "=", workId)
      .leftJoin("review", "review.work_id", "work.id")
      .select([
        "review.id as review_id",
        "review.score",
        "review.user_id",
        "review.created_date",
      ])
      .groupBy(["review.id", "work.id", "work_list_item.time_added"])
      .execute();
  }
}

export default new ReviewRepository();
