import { WorkListType } from "../../../lib/types/generated/db";
import { db } from "../utils/database";

class ReviewRepository {
  async getReviewList(clubId: string) {
    return db
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
        "movie_genres",
        "movie_genres.external_id",
        "movie_details.external_id",
      )
      .leftJoin(
        "movie_production_companies",
        "movie_production_companies.external_id",
        "movie_details.external_id",
      )
      .leftJoin(
        "movie_production_countries",
        "movie_production_countries.external_id",
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
        db.fn
          .agg<string[]>("array_agg", ["movie_genres.genre_name"])
          .distinct()
          .as("genres"),
        db.fn
          .agg<
            string[]
          >("array_agg", ["movie_production_companies.company_name"])
          .distinct()
          .as("production_companies"),
        db.fn
          .agg<
            string[]
          >("array_agg", ["movie_production_countries.country_name"])
          .distinct()
          .as("production_countries"),
      ])
      .groupBy([
        "review.id",
        "work.id",
        "work_list_item.time_added",
        "movie_details.external_id",
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
}

export default new ReviewRepository();
