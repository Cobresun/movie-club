import { ValueExpression, expressionBuilder } from "kysely";

import SettingsRepository from "./SettingsRepository";
import { DB, WorkListType } from "../../../lib/types/generated/db";
import { db } from "../utils/database";

class ListRepository {
  async getListByType(clubId: string, type: WorkListType) {
    return await db
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
      .selectFrom("work_list")
      .where("work_list.club_id", "=", clubId)
      .where("work_list.type", "=", type)
      .innerJoin("work_list_item", "work_list_item.list_id", "work_list.id")
      .innerJoin("work", "work.id", "work_list_item.work_id")
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
      .select([
        "work.id",
        "work.title",
        "work.type",
        "work.image_url",
        "work.external_id",
        "work_list_item.time_added",
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
      ])
      .execute();
  }

  async isItemInList(clubId: string, listType: WorkListType, workId: string) {
    return !!(await db
      .selectFrom("work_list_item")
      .select("list_id")
      .where("work_list_item.work_id", "=", workId)
      .where(
        "work_list_item.list_id",
        "=",
        this.listIdFromType(clubId, listType),
      )
      .executeTakeFirst());
  }

  async insertItemInList(
    clubId: string,
    listType: WorkListType,
    workId: string,
  ) {
    return db
      .insertInto("work_list_item")
      .values({
        list_id: this.listIdFromType(clubId, listType),
        work_id: workId,
      })
      .execute();
  }

  async deleteItemFromList(
    clubId: string,
    listType: WorkListType,
    workId: string,
  ) {
    return db
      .deleteFrom("work_list_item")
      .where("work_list_item.work_id", "=", workId)
      .where(
        "work_list_item.list_id",
        "=",
        this.listIdFromType(clubId, listType),
      )
      .execute();
  }

  private listIdFromType(
    clubId: string,
    type: WorkListType,
  ): ValueExpression<DB, "work_list_item", string> {
    const eb = expressionBuilder<DB, "work_list_item">();
    return eb
      .selectFrom("work_list")
      .where("club_id", "=", clubId)
      .where("type", "=", type)
      .select("id");
  }

  async getWorkDetails(workId: string) {
    return await db
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
      .selectFrom("work")
      .where("work.id", "=", workId)
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
      .select([
        "work.id",
        "work.title",
        "work.type",
        "work.image_url",
        "work.external_id",
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
      ])
      .executeTakeFirst();
  }

  async createListsForClub(clubId: string) {
    const defaultTitles: Record<WorkListType, string> = {
      backlog: "Backlog",
      watchlist: "Watch List",
      reviews: "Reviews",
      award_nominations: "Award Nominations",
    };

    return await db
      .insertInto("work_list")
      .values(
        Object.values(WorkListType).map((type) => ({
          club_id: clubId,
          type: type,
          title: defaultTitles[type],
        })),
      )
      .execute();
  }
}

export function isWorkListType(type: string): type is WorkListType {
  return Object.values(WorkListType).includes(type as WorkListType);
}

export default new ListRepository();
