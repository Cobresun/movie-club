import { z } from "zod";

import { db } from "../utils/database";

export const clubSettingsSchema = z.object({
  features: z.object({
    awards: z.boolean(),
    discussionQuestions: z.boolean(),
  }),
});

export type ClubSettings = z.infer<typeof clubSettingsSchema>;

/** Every field optional: an update patches whichever features it names. */
export const clubSettingsUpdateSchema = z.object({
  features: clubSettingsSchema.shape.features.partial().optional(),
});

export type ClubSettingsUpdate = z.infer<typeof clubSettingsUpdateSchema>;

const DEFAULT_SETTINGS: ClubSettings = {
  features: {
    awards: false,
    discussionQuestions: false,
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

    // The column is untyped JSON, so anything could be in there — a row written
    // before a feature flag existed reads back as a partial.
    const storedSettings = clubSettingsUpdateSchema.safeParse(result.value);
    return {
      features: {
        ...DEFAULT_SETTINGS.features,
        ...(storedSettings.success ? storedSettings.data.features : undefined),
      },
    };
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
        value: JSON.stringify(DEFAULT_SETTINGS),
      })
      .onConflict((eb) => eb.columns(["club_id", "key"]).doNothing())
      .execute();
  }
}

export default new SettingsRepository();
