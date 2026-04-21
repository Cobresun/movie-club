import { sql } from "kysely";

import { WorkListSystemType } from "../../../lib/types/generated/db";
import { db } from "../utils/database";

class ListRepository {
  // -- List CRUD --------------------------------------------------------

  async getListsForClub(
    clubId: string,
    options: { includeSystem?: boolean } = {},
  ) {
    let query = db
      .selectFrom("work_list")
      .leftJoin("work_list_item", "work_list_item.list_id", "work_list.id")
      .where("work_list.club_id", "=", clubId)
      .select([
        "work_list.id",
        "work_list.title",
        "work_list.system_type",
        "work_list.position",
        sql<string>`COUNT(work_list_item.work_id)`.as("item_count"),
      ])
      .groupBy([
        "work_list.id",
        "work_list.title",
        "work_list.system_type",
        "work_list.position",
      ])
      .orderBy("work_list.position", "asc")
      .orderBy("work_list.id", "asc");

    if (options.includeSystem !== true) {
      query = query.where("work_list.system_type", "is", null);
    }

    return query.execute();
  }

  async getListById(listId: string) {
    return db
      .selectFrom("work_list")
      .selectAll()
      .where("id", "=", listId)
      .executeTakeFirst();
  }

  async createList(clubId: string, title: string) {
    return db.transaction().execute(async (trx) => {
      const max = await trx
        .selectFrom("work_list")
        .where("club_id", "=", clubId)
        .select(
          sql<number>`COALESCE(MAX(position), -1) + 1`.as("next_position"),
        )
        .executeTakeFirstOrThrow();

      return trx
        .insertInto("work_list")
        .values({ club_id: clubId, title, position: max.next_position })
        .returning(["id", "title", "system_type", "club_id"])
        .executeTakeFirstOrThrow();
    });
  }

  async renameList(listId: string, title: string) {
    return db
      .updateTable("work_list")
      .set({ title })
      .where("id", "=", listId)
      .execute();
  }

  async deleteList(listId: string) {
    // The fk_work_list_item_list_id constraint cascades work_list_item rows.
    // The route layer must guard against deleting system lists (especially
    // `reviews`, which is referenced by the `review` table FK and would
    // otherwise leave reviews orphaned).
    return db.deleteFrom("work_list").where("id", "=", listId).execute();
  }

  /**
   * Creates the default lists for a brand-new club: one user-facing
   * "Watch List" plus the invisible system lists used by the reviews and
   * awards features.
   */
  async createListsForClub(clubId: string) {
    return db
      .insertInto("work_list")
      .values([
        { club_id: clubId, title: "Watch List" },
        {
          club_id: clubId,
          title: "Reviews",
          system_type: WorkListSystemType.reviews,
        },
        {
          club_id: clubId,
          title: "Award Nominations",
          system_type: WorkListSystemType.award_nominations,
        },
      ])
      .execute();
  }

  // -- System list lookups ----------------------------------------------

  async getSystemListId(clubId: string, systemType: WorkListSystemType) {
    const row = await db
      .selectFrom("work_list")
      .select("id")
      .where("club_id", "=", clubId)
      .where("system_type", "=", systemType)
      .executeTakeFirstOrThrow();
    return row.id;
  }

  async getReviewsListId(clubId: string) {
    return this.getSystemListId(clubId, WorkListSystemType.reviews);
  }

  async getAwardNominationsListId(clubId: string) {
    return this.getSystemListId(clubId, WorkListSystemType.award_nominations);
  }

  // -- List item operations (now keyed by listId) -----------------------

  async getListItems(listId: string) {
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
      .with("directors_agg", (qb) =>
        qb
          .selectFrom("movie_directors")
          .select([
            "external_id",
            sql<
              { name: string; profilePath: string | null }[]
            >`json_agg(json_build_object('name', director_name, 'profilePath', profile_path))`.as(
              "directors",
            ),
          ])
          .groupBy("external_id"),
      )
      .with("actors_agg", (qb) =>
        qb
          .selectFrom("movie_actors")
          .select([
            "external_id",
            sql<
              { name: string; profilePath: string | null }[]
            >`json_agg(json_build_object('name', actor_name, 'profilePath', profile_path) ORDER BY cast_order)`.as(
              "actors",
            ),
          ])
          .groupBy("external_id"),
      )
      .selectFrom("work_list_item")
      .where("work_list_item.list_id", "=", listId)
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
        "directors_agg.directors",
        "actors_agg.actors",
      ])
      .orderBy("work_list_item.position", "asc")
      .execute();
  }

  async isItemInList(listId: string, workId: string) {
    return !!(await db
      .selectFrom("work_list_item")
      .select("list_id")
      .where("work_id", "=", workId)
      .where("list_id", "=", listId)
      .executeTakeFirst());
  }

  async insertItemInList(listId: string, workId: string) {
    const maxResult = await db
      .selectFrom("work_list_item")
      .where("list_id", "=", listId)
      .select(sql<number>`COALESCE(MAX(position), 0) + 1`.as("next_position"))
      .executeTakeFirstOrThrow();

    return db
      .insertInto("work_list_item")
      .values({
        list_id: listId,
        work_id: workId,
        position: maxResult.next_position,
      })
      .execute();
  }

  async deleteItemFromList(listId: string, workId: string) {
    return db
      .deleteFrom("work_list_item")
      .where("work_id", "=", workId)
      .where("list_id", "=", listId)
      .execute();
  }

  /**
   * Move a work from one list to another atomically. Used by the "move to..."
   * UI and by the review flow (which moves from any source list into the
   * `reviews` system list). The destination insert is a no-op if the work is
   * already on the target list, so a movie can safely be on multiple lists.
   */
  async moveItem(
    sourceListId: string,
    destinationListId: string,
    workId: string,
  ) {
    return db.transaction().execute(async (trx) => {
      const max = await trx
        .selectFrom("work_list_item")
        .where("list_id", "=", destinationListId)
        .select(sql<number>`COALESCE(MAX(position), 0) + 1`.as("next_position"))
        .executeTakeFirstOrThrow();

      await trx
        .insertInto("work_list_item")
        .values({
          list_id: destinationListId,
          work_id: workId,
          position: max.next_position,
        })
        .onConflict((oc) => oc.columns(["list_id", "work_id"]).doNothing())
        .execute();

      await trx
        .deleteFrom("work_list_item")
        .where("list_id", "=", sourceListId)
        .where("work_id", "=", workId)
        .execute();
    });
  }

  // -- Reordering -------------------------------------------------------

  /**
   * Reorder the lists themselves within a club. `listIds` must be the full
   * set of lists (system lists included) in the desired order. Positions are
   * reassigned to the index within the array.
   */
  async reorderLists(clubId: string, listIds: string[]) {
    if (listIds.length === 0) return;

    return db.transaction().execute(async (trx) => {
      // Verify every id belongs to this club — prevents a malicious caller
      // from reordering another club's lists.
      const owned = await trx
        .selectFrom("work_list")
        .select("id")
        .where("club_id", "=", clubId)
        .where("id", "in", listIds)
        .execute();

      const ownedIds = new Set(owned.map((r) => String(r.id)));
      const valid = listIds.filter((id) => ownedIds.has(id));
      if (valid.length === 0) return;

      const whenClauses = valid.map((id, i) => sql`WHEN ${id} THEN ${i}`);

      await trx
        .updateTable("work_list")
        .set({
          position: sql`CASE id ${sql.join(whenClauses, sql` `)} END`,
        })
        .where("club_id", "=", clubId)
        .where("id", "in", valid)
        .execute();
    });
  }

  // The frontend may send a subset of IDs (e.g. the user filtered/searched the
  // list and is reordering only the visible subset). This method assigns the
  // reordered items to the same position slots they previously occupied, so
  // non-reordered items keep their positions.
  async reorderList(listId: string, workIds: string[]) {
    const currentPositions = await db
      .selectFrom("work_list_item")
      .where("list_id", "=", listId)
      .where("work_id", "in", workIds)
      .select(["work_id", "position"])
      .execute();

    const foundIds = new Set(currentPositions.map((row) => row.work_id));
    const validWorkIds = workIds.filter((id) => foundIds.has(id));

    if (validWorkIds.length === 0) return;

    const slots = currentPositions
      .map((row) => Number(row.position))
      .sort((a, b) => a - b);

    const whenClauses = validWorkIds.map(
      (id, i) => sql`WHEN ${id} THEN ${slots[i]}`,
    );

    await db
      .updateTable("work_list_item")
      .set({
        position: sql`CASE work_id ${sql.join(whenClauses, sql` `)} END`,
      })
      .where("list_id", "=", listId)
      .where("work_id", "in", validWorkIds)
      .execute();
  }

  async updateAddedDate(listId: string, workId: string, addedDate: Date) {
    return db
      .updateTable("work_list_item")
      .set("time_added", addedDate)
      .where("work_id", "=", workId)
      .where("list_id", "=", listId)
      .execute();
  }

  // -- Misc -------------------------------------------------------------

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
      .with("directors_agg", (qb) =>
        qb
          .selectFrom("movie_directors")
          .select([
            "external_id",
            sql<
              { name: string; profilePath: string | null }[]
            >`json_agg(json_build_object('name', director_name, 'profilePath', profile_path))`.as(
              "directors",
            ),
          ])
          .groupBy("external_id"),
      )
      .with("actors_agg", (qb) =>
        qb
          .selectFrom("movie_actors")
          .select([
            "external_id",
            sql<
              { name: string; profilePath: string | null }[]
            >`json_agg(json_build_object('name', actor_name, 'profilePath', profile_path) ORDER BY cast_order)`.as(
              "actors",
            ),
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
        "directors_agg.directors",
        "actors_agg.actors",
      ])
      .executeTakeFirst();
  }
}

export default new ListRepository();
