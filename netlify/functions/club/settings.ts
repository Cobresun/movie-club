import { z } from "zod";

import { hasValue } from "../../../lib/checks/checks.js";
import SettingsRepository from "../repositories/SettingsRepository.js";
import { ClubSettings } from "../repositories/SettingsRepository.js";
import { secured } from "../utils/auth";
import { badRequest, ok } from "../utils/responses";
import { Router } from "../utils/router";
import { ClubRequest } from "../utils/validation";

const router = new Router<ClubRequest>("/api/club/:clubSlug/settings");

router.get("/", secured, async ({ clubId }, res) => {
  const settings = await SettingsRepository.getSettings(clubId);
  return res(ok(JSON.stringify(settings)));
});

const updateSettingsSchema = z.object({
  features: z
    .object({
      blurScores: z.boolean(),
      awards: z.boolean(),
    })
    .partial()
    .optional(),
});

router.post("/", secured, async ({ clubId, event }, res) => {
  if (!hasValue(event.body)) return res(badRequest("No body provided"));

  const body = updateSettingsSchema.safeParse(JSON.parse(event.body));
  if (!body.success) return res(badRequest("Invalid body"));

  const settings = await SettingsRepository.updateSettings(
    clubId,
    body.data as Partial<ClubSettings>,
  );
  return res(ok(JSON.stringify(settings)));
});

export default router;
