import { ClubSettings, clubSettingsUpdateSchema } from "../../../lib/types/club";
import SettingsRepository from "../repositories/SettingsRepository.js";
import { secured } from "../utils/auth";
import { parseBody } from "../utils/parseBody";
import { ok } from "../utils/responses";
import { isRouterResponse, Router } from "../utils/router";
import { ClubRequest } from "../utils/validation";

const router = new Router<ClubRequest>("/api/club/:clubSlug/settings");

router.get("/", secured, async ({ clubId }, res) => {
  const settings = await SettingsRepository.getSettings(clubId);
  return res(ok<ClubSettings>(settings));
});

router.post("/", secured, async ({ clubId, event }, res) => {
  const body = parseBody(event, clubSettingsUpdateSchema, res);
  if (isRouterResponse(body)) return body;

  const settings = await SettingsRepository.updateSettings(clubId, body);
  return res(ok<ClubSettings>(settings));
});

export default router;
