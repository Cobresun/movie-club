import { db } from "../utils/database";

export interface ClubSettings {
  features: {
    blurScores: boolean;
  };
}

const DEFAULT_SETTINGS: ClubSettings = {
  features: {
    blurScores: true,
  },
};

class SettingsRepository {
  async getSettings(clubId: string): Promise<ClubSettings> {
    const result = await db
      .selectFrom("club_settings")
      .select("value")
      .where("club_id", "=", clubId)
      .where("key", "=", "features")
      .executeTakeFirst();

    if (!result || result.value === null) {
      return DEFAULT_SETTINGS;
    }

    const storedSettings = result.value as Partial<ClubSettings>;
    return {
      features: {
        ...DEFAULT_SETTINGS.features,
        ...storedSettings.features,
      },
    };
  }

  async updateSettings(
    clubId: string,
    settings: Partial<ClubSettings>,
  ): Promise<ClubSettings> {
    const existing = await this.getSettings(clubId);
    const merged = {
      features: {
        ...existing.features,
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
    await db
      .insertInto("club_settings")
      .values({
        club_id: clubId,
        key: "features",
        value: JSON.stringify(DEFAULT_SETTINGS),
      })
      .onConflict((eb) => eb.columns(["club_id", "key"]).doNothing())
      .execute();
  }
}

export default new SettingsRepository();
