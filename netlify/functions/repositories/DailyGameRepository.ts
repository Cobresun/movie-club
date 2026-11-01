import { WorkType } from "../../../lib/types/generated/db.js";
import { db } from "../utils/database";

/** A `YYYY-MM-DD` calendar day as the midnight-UTC instant the date column compares against. */
const asDay = (date: string) => new Date(`${date}T00:00:00Z`);

class DailyGameRepository {
  /**
   * Every movie with cached details that a club has added or the catalog
   * holds, once each. A movie's own TMDB title wins over a club's spelling of
   * it; a movie with neither is left out.
   */
  async getMoviePool(): Promise<{ externalId: string; title: string }[]> {
    const rows = await db
      .selectFrom("movie_details")
      .leftJoin("work", (join) =>
        join
          .onRef("work.external_id", "=", "movie_details.external_id")
          .on("work.type", "=", WorkType.movie),
      )
      .leftJoin("daily_game_catalog", "daily_game_catalog.external_id", "movie_details.external_id")
      .where((eb) =>
        eb.or([
          eb("work.id", "is not", null),
          eb("daily_game_catalog.external_id", "is not", null),
        ]),
      )
      .select([
        "movie_details.external_id",
        "movie_details.title as details_title",
        "work.title as work_title",
      ])
      .distinctOn("movie_details.external_id")
      .orderBy("movie_details.external_id")
      .execute();
    return rows.flatMap((row) => {
      const title = row.details_title ?? row.work_title;
      return title === null ? [] : [{ externalId: row.external_id, title }];
    });
  }

  /** Which of `externalIds` the catalog already holds. */
  async getCatalogued(externalIds: string[]): Promise<Set<string>> {
    if (externalIds.length === 0) return new Set();
    const rows = await db
      .selectFrom("daily_game_catalog")
      .select("external_id")
      .where("external_id", "in", externalIds)
      .execute();
    return new Set(rows.map((row) => row.external_id));
  }

  /** Adds a movie whose details are already cached to the catalog. */
  async addToCatalog(externalId: string): Promise<void> {
    await db
      .insertInto("daily_game_catalog")
      .values({ external_id: externalId })
      .onConflict((oc) => oc.column("external_id").doNothing())
      .execute();
  }

  async getAnswer(date: string): Promise<string | undefined> {
    const row = await db
      .selectFrom("daily_game_puzzle")
      .select("external_id")
      .where("puzzle_date", "=", asDay(date))
      .executeTakeFirst();
    return row?.external_id;
  }

  /** Every answer so far, oldest first. */
  async getPastAnswers(): Promise<string[]> {
    const rows = await db
      .selectFrom("daily_game_puzzle")
      .select("external_id")
      .orderBy("puzzle_date")
      .execute();
    return rows.map((row) => row.external_id);
  }

  /**
   * Records `externalId` as the answer for `date` unless another request got
   * there first, and returns whichever answer stands.
   */
  async claimAnswer(date: string, externalId: string): Promise<string> {
    await db
      .insertInto("daily_game_puzzle")
      .values({ puzzle_date: date, external_id: externalId })
      .onConflict((oc) => oc.column("puzzle_date").doNothing())
      .execute();
    const answer = await this.getAnswer(date);
    return answer ?? externalId;
  }

  /** The puzzle's number: how many days Closer has had, up to and including `date`. */
  async getPuzzleNumber(date: string): Promise<number> {
    const row = await db
      .selectFrom("daily_game_puzzle")
      .select((eb) => eb.fn.countAll<string>().as("count"))
      .where("puzzle_date", "<=", asDay(date))
      .executeTakeFirstOrThrow();
    return Number(row.count);
  }
}

export default new DailyGameRepository();
