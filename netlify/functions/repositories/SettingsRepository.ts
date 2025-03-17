import { db } from "../utils/database";

interface ClubSettings {
  features?: {
    blurScores?: boolean;
  };
}

class SettingsRepository {
  async getSettings(clubId: string): Promise<ClubSettings | null> {
    const result = await db
      .selectFrom("club_settings")
      .select("value")
      .where("club_id", "=", clubId)
      .where("key", "=", "features")
      .executeTakeFirst();

    return result && result.value !== null
      ? (result.value as ClubSettings)
      : null;
  }

  async updateSettings(
    clubId: string,
    settings: Partial<ClubSettings>,
  ): Promise<ClubSettings> {
    const existing = await this.getSettings(clubId);
    const merged = {
      features: {
        ...existing?.features,
        ...settings.features,
      },
    };
    console.log("Merged", merged);

    await db
      .insertInto("club_settings")
      .values({
        club_id: clubId,
        key: "features",
        value: JSON.stringify(merged),
      })
      .onConflict((eb) =>
        eb
          .columns(["club_id", "key"])
          .doUpdateSet({ value: JSON.stringify(merged) }),
      )
      .execute();

    return merged;
  }

  async createDefaultSettings(clubId: string): Promise<void> {
    const defaultSettings: ClubSettings = {
      features: {
        blurScores: true,
      },
    };

    await db
      .insertInto("club_settings")
      .values({
        club_id: clubId,
        key: "features",
        value: JSON.stringify(defaultSettings),
      })
      .onConflict((eb) => eb.columns(["club_id", "key"]).doNothing())
      .execute();
  }
}

export default new SettingsRepository();
