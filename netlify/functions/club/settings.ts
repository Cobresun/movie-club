import { z } from "zod";

import SettingsRepository from "../repositories/SettingsRepository.js";
import { ClubSettings } from "../repositories/SettingsRepository.js";
import { secured } from "../utils/auth";
import { parseBody } from "../utils/parseBody";
import { ok } from "../utils/responses";
import { isRouterResponse, Router } from "../utils/router";
import { ClubRequest } from "../utils/validation";

const router = new Router<ClubRequest>("/api/club/:clubSlug/settings");

router.get("/", secured, async ({ clubId }, res) => {
  const settings = await SettingsRepository.getSettings(clubId);
  return res(ok(JSON.stringify(settings)));
});

const updateSettingsSchema = z.object({
  features: z
    .object({
      awards: z.boolean(),
      discussionQuestions: z.boolean(),
    })
    .partial()
    .optional(),
});

router.post("/", secured, async ({ clubId, event }, res) => {
  const body = parseBody(event, updateSettingsSchema, res);
  if (isRouterResponse(body)) return body;

  const settings = await SettingsRepository.updateSettings(clubId, body as Partial<ClubSettings>);
  return res(ok(JSON.stringify(settings)));
});

export default router;
