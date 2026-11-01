import { type WorkType } from "../../../lib/types/generated/db";
import { db } from "../utils/database";
import { type CatalogCandidate } from "../utils/providers/types";

/** A `YYYY-MM-DD` calendar day as the midnight-UTC instant the date column compares against. */
const asDay = (date: string) => new Date(`${date}T00:00:00Z`);

class DailyGameRepository {
  /** Every work in the catalog of `type`: the game's whole pool. */
  async getPool(type: WorkType): Promise<CatalogCandidate[]> {
    const rows = await db
      .selectFrom("daily_game_catalog")
      .select(["external_id", "title"])
      .where("work_type", "=", type)
      .execute();
    return rows.map((row) => ({ externalId: row.external_id, title: row.title }));
  }

  /** Which of `externalIds` the catalog of `type` already holds. */
  async getCatalogued(type: WorkType, externalIds: string[]): Promise<Set<string>> {
    if (externalIds.length === 0) return new Set();
    const rows = await db
      .selectFrom("daily_game_catalog")
      .select("external_id")
      .where("work_type", "=", type)
      .where("external_id", "in", externalIds)
      .execute();
    return new Set(rows.map((row) => row.external_id));
  }

  /** When the catalog of `type` last grew, or undefined while it is empty. */
  async getLastCatalogAddition(type: WorkType): Promise<Date | undefined> {
    const row = await db
      .selectFrom("daily_game_catalog")
      .select((eb) => eb.fn.max("created_at").as("latest"))
      .where("work_type", "=", type)
      .executeTakeFirst();
    return row?.latest ?? undefined;
  }

  /** Adds a work whose details are already cached to the catalog of `type`. */
  async addToCatalog(type: WorkType, work: CatalogCandidate): Promise<void> {
    await db
      .insertInto("daily_game_catalog")
      .values({ work_type: type, external_id: work.externalId, title: work.title })
      .onConflict((oc) => oc.columns(["work_type", "external_id"]).doNothing())
      .execute();
  }

  async getAnswer(type: WorkType, date: string): Promise<string | undefined> {
    const row = await db
      .selectFrom("daily_game_puzzle")
      .select("external_id")
      .where("work_type", "=", type)
      .where("puzzle_date", "=", asDay(date))
      .executeTakeFirst();
    return row?.external_id;
  }

  /** Every answer the game of `type` has had, oldest first. */
  async getPastAnswers(type: WorkType): Promise<string[]> {
    const rows = await db
      .selectFrom("daily_game_puzzle")
      .select("external_id")
      .where("work_type", "=", type)
      .orderBy("puzzle_date")
      .execute();
    return rows.map((row) => row.external_id);
  }

  /**
   * Records `externalId` as the answer for `date` unless another request got
   * there first, and returns whichever answer stands.
   */
  async claimAnswer(type: WorkType, date: string, externalId: string): Promise<string> {
    await db
      .insertInto("daily_game_puzzle")
      .values({ work_type: type, puzzle_date: date, external_id: externalId })
      .onConflict((oc) => oc.columns(["work_type", "puzzle_date"]).doNothing())
      .execute();
    return (await this.getAnswer(type, date)) ?? externalId;
  }

  /** The puzzle's number: how many days the game of `type` has had, up to and including `date`. */
  async getPuzzleNumber(type: WorkType, date: string): Promise<number> {
    const row = await db
      .selectFrom("daily_game_puzzle")
      .select((eb) => eb.fn.countAll<string>().as("count"))
      .where("work_type", "=", type)
      .where("puzzle_date", "<=", asDay(date))
      .executeTakeFirstOrThrow();
    return Number(row.count);
  }
}

export default new DailyGameRepository();
