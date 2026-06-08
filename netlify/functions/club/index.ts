import { Handler, HandlerContext, HandlerEvent } from "@netlify/functions";
import { z } from "zod";

import awardsRouter from "./awards.js";
import inviteRouter from "./invite.js";
import listRouter from "./list.js";
import membersRouter from "./members.js";
import joinRouter from "./members/join.js";
import reviewsRouter from "./reviews.js";
import settingsRouter from "./settings.js";
import { ensure, hasValue } from "../../../lib/checks/checks.js";
import { ClubPreview } from "../../../lib/types/club.js";
import ClubRepository from "../repositories/ClubRepository.js";
import ListRepository from "../repositories/ListRepository.js";
import SettingsRepository from "../repositories/SettingsRepository.js";
import UserRepository from "../repositories/UserRepository.js";
import WorkRepository from "../repositories/WorkRepository.js";
import { loggedIn, secured } from "../utils/auth.js";
import { db } from "../utils/database.js";
import { ok, badRequest } from "../utils/responses.js";
import { Router } from "../utils/router.js";
import { validateSlug } from "../utils/slug.js";
import { validClubSlug } from "../utils/validation.js";

const router = new Router("/api/club");
router.use("/:clubSlug/list", validClubSlug, listRouter);
router.use("/:clubSlug/reviews", validClubSlug, reviewsRouter);
router.use("/:clubSlug/members", validClubSlug, membersRouter);
router.use("/:clubSlug/awards", validClubSlug, awardsRouter);
router.use("/:clubSlug/invite", validClubSlug, inviteRouter);
router.use("/:clubSlug/settings", validClubSlug, settingsRouter);
router.get("/:clubSlug", validClubSlug, async ({ clubId }, res) => {
  const club = ensure(await ClubRepository.getById(clubId));
  const result: ClubPreview = {
    clubId: club.id,
    clubName: club.name,
    slug: club.slug,
    slugUpdatedAt: club.slug_updated_at
      ? String(club.slug_updated_at)
      : undefined,
  };
  return res(ok(JSON.stringify(result)));
});

const clubNameUpdateSchema = z.object({
  name: z.string().min(1).max(100),
});

router.put(
  "/:clubSlug/name",
  validClubSlug,
  secured,
  async ({ event, clubId }, res) => {
    if (!hasValue(event.body)) return res(badRequest("Missing body"));

    const body = clubNameUpdateSchema.safeParse(JSON.parse(event.body));
    if (!body.success) return res(badRequest("Invalid body"));

    const { name } = body.data;
    await ClubRepository.updateName(clubId, name);

    return res(ok());
  },
);

router.use("/join", joinRouter);
router.use("/joinInfo/:token", joinRouter);

const clubCreateSchema = z.object({
  name: z.string(),
  members: z.array(z.string()),
});

router.post("/", loggedIn, async ({ event }, res) => {
  if (!hasValue(event.body)) return res(badRequest("Missing body"));

  const body = clubCreateSchema.safeParse(JSON.parse(event.body));
  if (!body.success) return res(badRequest("Invalid body"));
  const { name, members } = body.data;

  const legacyClubId = Math.floor(Math.random() * 100000);

  // Create Club
  const newClub = await ClubRepository.insert(name, legacyClubId);

  if (!newClub) {
    return res(badRequest("Failed to create club in database"));
  }

  // Creat WatchList, Backlog, Reviews lists
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

  return res(
    hasErrors
      ? badRequest("Error creating club")
      : ok(JSON.stringify({ clubId: newClub.id, slug: String(newClub.slug) })),
  );
});

router.get("/:clubSlug/nextWork", validClubSlug, async ({ clubId }, res) => {
  const nextWork = await WorkRepository.getNextWork(clubId);
  return res(ok(JSON.stringify({ workId: nextWork?.work_id })));
});

const nextWorkSchema = z.object({
  workId: z.string(),
});

router.put(
  "/:clubSlug/nextWork",
  validClubSlug,
  secured,
  async ({ event, clubId }, res) => {
    if (!hasValue(event.body)) return res(badRequest("Missing body"));
    const body = nextWorkSchema.safeParse(JSON.parse(event.body));
    if (!body.success) return res(badRequest("Invalid body"));
    const { workId } = body.data;

    await WorkRepository.deleteNextWork(clubId);
    await WorkRepository.setNextWork(clubId, workId);

    return res(ok());
  },
);

router.delete(
  "/:clubSlug/nextWork",
  validClubSlug,
  secured,
  async ({ clubId }, res) => {
    await WorkRepository.deleteNextWork(clubId);
    return res(ok());
  },
);

const updateSlugSchema = z.object({
  slug: z.string(),
});

router.put(
  "/:clubSlug/slug",
  validClubSlug,
  secured,
  async ({ clubId, event }, res) => {
    if (!hasValue(event.body)) return res(badRequest("Missing body"));

    const body = updateSlugSchema.safeParse(JSON.parse(event.body));
    if (!body.success) return res(badRequest("Invalid body"));

    const { slug: newSlug } = body.data;

    const validationError = validateSlug(newSlug);
    if (hasValue(validationError)) {
      return res(badRequest(validationError));
    }

    const slugTaken = await ClubRepository.slugExists(newSlug, clubId);
    if (slugTaken) {
      return res(badRequest("This url is already in use by another club"));
    }

    await ClubRepository.updateSlug(clubId, newSlug);

    return res(ok(JSON.stringify({ slug: newSlug })));
  },
);

const handler: Handler = async (
  event: HandlerEvent,
  context: HandlerContext,
) => {
  return router.route({ event, context, params: {} });
};

export { handler };
