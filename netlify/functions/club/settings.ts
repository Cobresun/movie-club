import { Router } from "itty-router";
import { z } from "zod";

import SettingsRepository from "../repositories/SettingsRepository.js";
import { ClubSettings } from "../repositories/SettingsRepository.js";
import { secured } from "../utils/auth";
import { badRequest, ok } from "../utils/responses";
import { ClubRequest } from "../utils/validation";

const router = Router<ClubRequest>({ base: "/api/club/:clubId/settings" });

router.get("/", secured, async ({ clubId }) => {
  const settings = await SettingsRepository.getSettings(clubId);
  return ok(JSON.stringify(settings));
});

const updateSettingsSchema = z.object({
  features: z
    .object({
      blurScores: z.boolean(),
    })
    .partial()
    .optional(),
});

router.post("/", secured, async (req) => {
  const { clubId } = req;
  const jsonBody: unknown = await req.json();

  const body = updateSettingsSchema.safeParse(jsonBody);
  if (!body.success) return badRequest("Invalid body");

  const settings = await SettingsRepository.updateSettings(
    clubId,
    body.data as Partial<ClubSettings>,
  );
  return ok(JSON.stringify(settings));
});

export default router;
