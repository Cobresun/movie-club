import { WorkType } from "../../../lib/types/generated/db.js";
import { db } from "../utils/database";

/** A `YYYY-MM-DD` calendar day as the midnight-UTC instant the date column compares against. */
const asDay = (date: string) => new Date(`${date}T00:00:00Z`);

class DailyGameRepository {
  /**
   * Every movie any club has added that has cached details, once each. A
   * movie's own TMDB title wins over a club's spelling of it.
   */
  async getMoviePool(): Promise<{ externalId: string; title: string }[]> {
    const rows = await db
      .selectFrom("work")
      .innerJoin("movie_details", "movie_details.external_id", "work.external_id")
      .where("work.type", "=", WorkType.movie)
      .select([
        "movie_details.external_id",
        "movie_details.title as details_title",
        "work.title as work_title",
      ])
      .distinctOn("movie_details.external_id")
      .orderBy("movie_details.external_id")
      .execute();
    return rows.map((row) => ({
      externalId: row.external_id,
      title: row.details_title ?? row.work_title,
    }));
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
