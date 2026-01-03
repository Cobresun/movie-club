import { sql } from "kysely";

import { AwardsData, awardsDataSchema } from "../../../lib/types/awards";
import { db } from "../utils/database";

class AwardsRepository {
  /**
   * Get all years that have awards for a club
   */
  async getYears(clubId: string): Promise<number[]> {
    const rows = await db
      .selectFrom("awards_temp")
      .select("year")
      .where("club_id", "=", clubId)
      .orderBy("year", "desc")
      .execute();

    return rows.map((row) => Number(row.year));
  }

  /**
   * Check if awards exist for a specific year
   */
  async existsByYear(clubId: string, year: number): Promise<boolean> {
    const row = await db
      .selectFrom("awards_temp")
      .select(sql<number>`1`.as("exists"))
      .where("club_id", "=", clubId)
      .where("year", "=", year.toString())
      .executeTakeFirst();

    return row !== undefined;
  }

  /**
   * Get awards data for a specific year (for read-only use)
   */
  async getByYear(clubId: string, year: number): Promise<AwardsData | null> {
    const row = await db
      .selectFrom("awards_temp")
      .select("data")
      .where("club_id", "=", clubId)
      .where("year", "=", year.toString())
      .executeTakeFirst();

    if (!row) {
      return null;
    }

    const parsed = awardsDataSchema.safeParse(row.data);
    if (!parsed.success) {
      console.error("Invalid awards data in database:", parsed.error);
      return null;
    }

    return parsed.data;
  }

  /**
   * Update awards data for a specific year using a transactional callback.
   * The callback receives the current data and returns the new data.
   * Uses SELECT ... FOR UPDATE to lock the row during the transaction.
   */
  async updateByYear(
    clubId: string,
    year: number,
    updater: (currentData: AwardsData) => AwardsData,
  ): Promise<void> {
    await db.transaction().execute(async (trx) => {
      // Lock the row with FOR UPDATE
      const row = await trx
        .selectFrom("awards_temp")
        .select("data")
        .where("club_id", "=", clubId)
        .where("year", "=", year.toString())
        .forUpdate()
        .executeTakeFirst();

      if (!row) {
        throw new Error(`Awards not found for club ${clubId} year ${year}`);
      }

      // Validate current data
      const parsed = awardsDataSchema.safeParse(row.data);
      if (!parsed.success) {
        throw new Error(`Invalid awards data in database: ${parsed.error}`);
      }

      // Apply the update
      const newData = updater(parsed.data);

      // Write back
      await trx
        .updateTable("awards_temp")
        .set({ data: JSON.stringify(newData) })
        .where("club_id", "=", clubId)
        .where("year", "=", year.toString())
        .execute();
    });
  }
}

export default new AwardsRepository();
