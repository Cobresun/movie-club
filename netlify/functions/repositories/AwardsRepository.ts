import { AwardsData, awardsDataSchema } from "../../../lib/types/awards";
import { db } from "../utils/database";

/** An update the current state of the year does not allow, with the reason. */
export interface AwardsRejection {
  rejected: string;
}

export const reject = (message: string): AwardsRejection => ({ rejected: message });

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
      .select("year")
      .where("club_id", "=", clubId)
      .where("year", "=", year.toString())
      .executeTakeFirst();

    return row !== undefined;
  }

  /**
   * Open a year. Returns false, writing nothing, when the year already exists.
   */
  async create(clubId: string, year: number, data: AwardsData): Promise<boolean> {
    const row = await db
      .insertInto("awards_temp")
      .values({ club_id: clubId, year: year.toString(), data: JSON.stringify(data) })
      .onConflict((oc) => oc.columns(["club_id", "year"]).doNothing())
      .returning("year")
      .executeTakeFirst();

    return row !== undefined;
  }

  async deleteByYear(clubId: string, year: number): Promise<void> {
    await db
      .deleteFrom("awards_temp")
      .where("club_id", "=", clubId)
      .where("year", "=", year.toString())
      .execute();
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
   * The callback receives the current data and returns the new data, or a
   * rejection to leave the row untouched; the rejection is returned.
   * Uses SELECT ... FOR UPDATE to lock the row during the transaction.
   */
  async updateByYear(
    clubId: string,
    year: number,
    updater: (currentData: AwardsData) => AwardsData | AwardsRejection,
  ): Promise<AwardsRejection | undefined> {
    return db.transaction().execute(async (trx) => {
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
      const result = updater(parsed.data);
      if ("rejected" in result) return result;

      // Write back
      await trx
        .updateTable("awards_temp")
        .set({ data: JSON.stringify(result) })
        .where("club_id", "=", clubId)
        .where("year", "=", year.toString())
        .execute();

      return undefined;
    });
  }
}

export default new AwardsRepository();
