import { z } from "zod";

import SettingsRepository from "../repositories/SettingsRepository.js";
import { ClubSettings } from "../repositories/SettingsRepository.js";
import { webSecured } from "../utils/auth";
import { badRequest, ok } from "../utils/web-responses";
import { WebRouter } from "../utils/web-router";
import { WebClubRequest } from "../utils/web-validation";

const router = new WebRouter<WebClubRequest>(
  "/api/club/:clubId<\\d+>/settings",
);

router.get("/", webSecured, async ({ clubId }, res) => {
  const settings = await SettingsRepository.getSettings(clubId);
  return res(ok(JSON.stringify(settings)));
});

const updateSettingsSchema = z.object({
  features: z
    .object({
      blurScores: z.boolean(),
    })
    .partial()
    .optional(),
});

router.post("/", webSecured, async ({ clubId, request }, res) => {
  const text = await request.text();
  if (!text) return res(badRequest("No body provided"));

  const body = updateSettingsSchema.safeParse(JSON.parse(text));
  if (!body.success) return res(badRequest("Invalid body"));

  const settings = await SettingsRepository.updateSettings(
    clubId,
    body.data as Partial<ClubSettings>,
  );
  return res(ok(JSON.stringify(settings)));
});

export default router;
