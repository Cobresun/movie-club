import { sql } from "kysely";

import { isDefined } from "../../../lib/checks/checks";
import { ClubType, WorkListSystemType } from "../../../lib/types/generated/db";
import { db } from "../utils/database";

class ListRepository {
  // -- List CRUD --------------------------------------------------------

  async getListsForClub(clubId: string) {
    return db
      .selectFrom("work_list")
      .leftJoin("work_list_item", "work_list_item.list_id", "work_list.id")
      .where("work_list.club_id", "=", clubId)
      .where("work_list.system_type", "is", null)
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
      .orderBy("work_list.id", "asc")
      .execute();
  }

  async getListById(listId: string, clubId: string) {
    return db
      .selectFrom("work_list")
      .selectAll()
      .where("id", "=", listId)
      .where("club_id", "=", clubId)
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
    // system_type IS NULL ensures system lists (reviews, etc.) are never deleted.
    return db
      .deleteFrom("work_list")
      .where("id", "=", listId)
      .where("system_type", "is", null)
      .execute();
  }

  /**
   * Creates the default lists for a brand-new club: one user-facing
   * "Watch List" plus the invisible system lists used by the reviews and
   * awards features.
   */
  async createListsForClub(clubId: string, clubType: ClubType) {
    const defaultListTitle =
      clubType === ClubType.book ? "Reading List" : "Watch List";
    return db
      .insertInto("work_list")
      .values([
        { club_id: clubId, title: defaultListTitle },
        {
          club_id: clubId,
          title: "Reviews",
          system_type: WorkListSystemType.reviews,
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

  // -- List item operations (now keyed by listId) -----------------------

  // Returns media-agnostic work + list-item columns. Type-specific metadata
  // (movie_details, book_details, …) is layered on by the caller via the
  // appropriate MediaProvider.getExternalData, keyed by external_id.
  async getListItems(listId: string) {
    return await db
      .selectFrom("work_list_item")
      .where("work_list_item.list_id", "=", listId)
      .innerJoin("work", "work.id", "work_list_item.work_id")
      .select([
        "work.id",
        "work.title",
        "work.type",
        "work.image_url",
        "work.external_id",
        "work_list_item.time_added",
        "work_list_item.added_by_user_id",
      ])
      .orderBy("work_list_item.position", "asc")
      .execute();
  }

  // Every item on every user (non-system) list of the club, tagged with its
  // source list, in one query. Ordered by list position then item position so
  // the response groups naturally by list.
  async getAllUserListItems(clubId: string) {
    return await db
      .selectFrom("work_list_item")
      .innerJoin("work_list", "work_list.id", "work_list_item.list_id")
      .innerJoin("work", "work.id", "work_list_item.work_id")
      .where("work_list.club_id", "=", clubId)
      .where("work_list.system_type", "is", null)
      .select([
        "work.id",
        "work.title",
        "work.type",
        "work.image_url",
        "work.external_id",
        "work_list_item.time_added",
        "work_list_item.added_by_user_id",
        "work_list_item.list_id",
        "work_list.title as list_title",
      ])
      .orderBy("work_list.position", "asc")
      .orderBy("work_list.id", "asc")
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

  /**
   * Append a work to a list in a single statement: the INSERT ... SELECT
   * computes the next position, and the (list_id, work_id) unique constraint
   * turns a duplicate into a no-op. Returns false when the work was already
   * on the list (nothing inserted).
   */
  async insertItemInList(listId: string, workId: string, userId: string) {
    const result = await db
      .insertInto("work_list_item")
      .columns(["list_id", "work_id", "position", "added_by_user_id"])
      .expression((eb) =>
        eb
          .selectFrom("work_list_item")
          .where("list_id", "=", listId)
          .select([
            eb.val(listId).as("list_id"),
            eb.val(workId).as("work_id"),
            sql<number>`COALESCE(MAX(position), 0) + 1`.as("position"),
            eb.val(userId).as("added_by_user_id"),
          ]),
      )
      .onConflict((oc) => oc.columns(["list_id", "work_id"]).doNothing())
      .executeTakeFirst();
    return (result.numInsertedOrUpdatedRows ?? 0n) > 0n;
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
   *
   * The original "added by" user and "time added" are carried forward to the
   * destination so attribution survives a move rather than resetting to the
   * mover and the current time.
   *
   * Exception: the reviews system list reuses `time_added` as the "date
   * reviewed", so a move into reviews must stamp the current time (the column
   * default) rather than carry the source list's added-date forward, which
   * would back-date the review.
   *
   * The destination lookup doubles as the club-ownership check (the caller's
   * club id must match), so callers don't need a separate validation query.
   * Returns false — without moving anything — when the destination list does
   * not exist in this club.
   */
  async moveItem(
    sourceListId: string,
    destinationListId: string,
    workId: string,
    clubId: string,
  ) {
    return db.transaction().execute(async (trx) => {
      const [max, source, destination] = await Promise.all([
        trx
          .selectFrom("work_list_item")
          .where("list_id", "=", destinationListId)
          .select(
            sql<number>`COALESCE(MAX(position), 0) + 1`.as("next_position"),
          )
          .executeTakeFirstOrThrow(),
        trx
          .selectFrom("work_list_item")
          .where("list_id", "=", sourceListId)
          .where("work_id", "=", workId)
          .select(["added_by_user_id", "time_added"])
          .executeTakeFirst(),
        trx
          .selectFrom("work_list")
          .where("id", "=", destinationListId)
          .where("club_id", "=", clubId)
          .select("system_type")
          .executeTakeFirst(),
      ]);

      if (!isDefined(destination)) {
        return false;
      }

      const isMoveIntoReviews =
        destination.system_type === WorkListSystemType.reviews;

      await trx
        .insertInto("work_list_item")
        .values({
          list_id: destinationListId,
          work_id: workId,
          position: max.next_position,
          added_by_user_id: source?.added_by_user_id ?? null,
          ...(isDefined(source?.time_added) && !isMoveIntoReviews
            ? { time_added: source.time_added }
            : {}),
        })
        .onConflict((oc) => oc.columns(["list_id", "work_id"]).doNothing())
        .execute();

      await trx
        .deleteFrom("work_list_item")
        .where("list_id", "=", sourceListId)
        .where("work_id", "=", workId)
        .execute();

      return true;
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
      // Fetch ALL user lists for this club to verify ownership and completeness.
      const owned = await trx
        .selectFrom("work_list")
        .select("id")
        .where("club_id", "=", clubId)
        .where("system_type", "is", null)
        .execute();

      const ownedIds = new Set(owned.map((r) => String(r.id)));
      const valid = listIds.filter((id) => ownedIds.has(id));

      // Payload must include every user list — partial reorders are rejected.
      // Use Set to detect duplicates: ["a","a"] with owned ["a","b"] would
      // pass a plain length check but miss "b".
      if (new Set(valid).size !== owned.length) {
        throw new Error(
          "Reorder payload must include all user lists for the club",
        );
      }
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

  // Media-agnostic work columns for a single work. Callers enrich with
  // MediaProvider.getExternalData using the returned `type` + `external_id`.
  async getWorkDetails(workId: string) {
    return await db
      .selectFrom("work")
      .where("work.id", "=", workId)
      .select([
        "work.id",
        "work.title",
        "work.type",
        "work.image_url",
        "work.external_id",
      ])
      .executeTakeFirst();
  }
}

export default new ListRepository();
