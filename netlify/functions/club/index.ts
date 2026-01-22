import { Context } from "@netlify/functions";
import { json, Router } from "itty-router";
import { z } from "zod";

import awardsRouter from "./awards";
import inviteRouter from "./invite";
import listRouter from "./list";
import membersRouter from "./members";
import joinRouter from "./members/join";
import reviewsRouter from "./reviews";
import settingsRouter from "./settings";
import { ClubPreview } from "../../../lib/types/club";
import ClubRepository from "../repositories/ClubRepository";
import ListRepository from "../repositories/ListRepository";
import SettingsRepository from "../repositories/SettingsRepository";
import UserRepository from "../repositories/UserRepository";
import WorkRepository from "../repositories/WorkRepository";
import { loggedIn, secured } from "../utils/auth";
import { db } from "../utils/database";
import { ok, badRequest } from "../utils/responses";
import { ClubRequest, validClubId } from "../utils/validation";

const router = Router<ClubRequest>({ base: "/api/club" });

router
  .all("/:clubId/list/*", validClubId, listRouter.fetch)
  .all("/:clubId/reviews/*", validClubId, reviewsRouter.fetch)
  .all("/:clubId/members/*", validClubId, membersRouter.fetch)
  .all("/:clubId/awards/*", validClubId, awardsRouter.fetch)
  .all("/:clubId/invite/*", validClubId, inviteRouter.fetch)
  .all("/:clubId/settings/*", validClubId, settingsRouter.fetch)
  .all("/join", joinRouter.fetch)
  .all("/joinInfo/:token", joinRouter.fetch);

router.get("/:clubId", validClubId, async ({ clubId }) => {
  const club = await ClubRepository.getById(clubId);
  const result: ClubPreview = {
    clubId: club.id,
    clubName: club.name,
  };
  return ok(JSON.stringify(result));
});

const clubCreateSchema = z.object({
  name: z.string(),
  members: z.array(z.string()),
});

router.post("/", loggedIn, async (req) => {
  const jsonBody: unknown = await req.json();
  const body = clubCreateSchema.safeParse(jsonBody);
  if (!body.success) return badRequest("Invalid body");
  const { name, members } = body.data;

  const legacyClubId = Math.floor(Math.random() * 100000);

  // Create Club
  const newClub = await ClubRepository.insert(name, legacyClubId);

  if (!newClub) {
    return badRequest("Failed to create club in database");
  }

  // Create WatchList, Backlog, Reviews lists
  await ListRepository.createListsForClub(newClub.id);

  // Create default settings
  await SettingsRepository.createDefaultSettings(newClub.id);

  // Create club_member entries for members
  let hasErrors = false;
  const memberPromises = members.map(async (email, index) => {
    try {
      const user = await UserRepository.getByEmail(email);
      await db
        .insertInto("club_member")
        .values({
          club_id: newClub.id,
          user_id: user.id,
          role: index === 0 ? "admin" : "member", // until better roles this makes the first member an admin
        })
        .execute();
    } catch (error) {
      hasErrors = true;
      console.log(`Failed to add member ${email}: ${String(error)}`);
    }
  });
  await Promise.all(memberPromises);

  return hasErrors
    ? badRequest("Error creating club")
    : ok(JSON.stringify({ clubId: newClub.id }));
});

router.get("/:clubId/nextWork", validClubId, async ({ clubId }) => {
  const nextWork = await WorkRepository.getNextWork(clubId);
  return ok(JSON.stringify({ workId: nextWork?.work_id }));
});

const nextWorkSchema = z.object({
  workId: z.string(),
});

router.put("/:clubId/nextWork", validClubId, secured, async (req) => {
  const { clubId } = req;

  const jsonBody: unknown = await req.json();
  const body = nextWorkSchema.safeParse(jsonBody);
  if (!body.success) return badRequest("Invalid body");
  const { workId } = body.data;

  await WorkRepository.deleteNextWork(clubId);
  await WorkRepository.setNextWork(clubId, workId);

  return ok();
});

export default async (request: Request, context: Context) => {
  return router.fetch(request, context).then(json);
};
// Add path configuration
export const config = {
  path: ["/api/club", "/api/club/*"],
};
