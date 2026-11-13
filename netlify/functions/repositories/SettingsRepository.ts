import {
  type ClubSettings,
  type ClubSettingsUpdate,
  clubSettingsUpdateSchema,
  DEFAULT_CLUB_SETTINGS,
} from "../../../lib/types/club";
import { db } from "../utils/database";

/** A club's `features` row as settings, filling in what the row does not say. */
export function settingsFromStored(value: unknown): ClubSettings {
  // The column is untyped JSON, so anything could be in there — a row written
  // before a feature flag existed reads back as a partial.
  const storedSettings = clubSettingsUpdateSchema.safeParse(value);
  return {
    features: {
      ...DEFAULT_CLUB_SETTINGS.features,
      ...(storedSettings.success ? storedSettings.data.features : undefined),
    },
  };
}

class SettingsRepository {
  async getSettings(clubId: string): Promise<ClubSettings> {
    const result = await db
      .selectFrom("club_settings")
      .select("value")
      .where("club_id", "=", clubId)
      .where("key", "=", "features")
      .executeTakeFirst();

    return settingsFromStored(result?.value);
  }

  async updateSettings(clubId: string, settings: ClubSettingsUpdate): Promise<ClubSettings> {
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
        eb.columns(["club_id", "key"]).doUpdateSet({ value: JSON.stringify(merged) }),
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
        value: JSON.stringify(DEFAULT_CLUB_SETTINGS),
      })
      .onConflict((eb) => eb.columns(["club_id", "key"]).doNothing())
      .execute();
  }
}

export default new SettingsRepository();
