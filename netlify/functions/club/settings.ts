import { z } from "zod";

import { hasValue } from "../../../lib/checks/checks.js";
import SettingsRepository from "../repositories/SettingsRepository.js";
import { secured } from "../utils/auth";
import { badRequest, notFound, ok } from "../utils/responses";
import { Router } from "../utils/router";
import { ClubRequest } from "../utils/validation";

const router = new Router<ClubRequest>("/api/club/:clubId<\\d+>/settings");

router.get("/", secured, async ({ clubId }, res) => {
  console.log("Getting settings for club", clubId);
  let settings = await SettingsRepository.getSettings(clubId);
  console.log("Settings", settings);
  if (!settings) {
    console.error("Error getting settings");
    // Create default settings
    await SettingsRepository.createDefaultSettings(clubId);
    settings = await SettingsRepository.getSettings(clubId);
    if (!settings) {
      console.error(
        "Error getting settings after attempting to create default settings",
      );
      return res(badRequest("Failed to get settings"));
    }
    console.log("Settings after creating default settings", settings);
    return res(ok(JSON.stringify(settings)));
  }
  return res(ok(JSON.stringify(settings)));
});

const updateSettingsSchema = z.object({
  features: z
    .object({
      blurScores: z.boolean().optional(),
    })
    .optional(),
});

router.post("/", secured, async ({ clubId, event }, res) => {
  if (!hasValue(event.body)) return res(badRequest("No body provided"));

  const body = updateSettingsSchema.safeParse(JSON.parse(event.body));
  if (!body.success) return res(badRequest("Invalid body"));

  const settings = await SettingsRepository.updateSettings(clubId, body.data);
  if (settings === null) return res(notFound());

  return res(ok(JSON.stringify(settings)));
});

export default router;
