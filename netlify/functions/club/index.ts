import { Handler, HandlerContext, HandlerEvent } from "@netlify/functions";
import { z } from "zod";

import awardsRouter from "./awards";
import inviteRouter from "./invite";
import listRouter from "./list";
import membersRouter from "./members";
import joinRouter from "./members/join";
import reviewsRouter from "./reviews";
import settingsRouter from "./settings";
import { ensure, hasValue } from "../../../lib/checks/checks.js";
import { ClubPreview } from "../../../lib/types/club";
import ClubRepository from "../repositories/ClubRepository";
import ListRepository from "../repositories/ListRepository";
import SettingsRepository from "../repositories/SettingsRepository";
import UserRepository from "../repositories/UserRepository";
import WorkRepository from "../repositories/WorkRepository";
import { loggedIn, secured } from "../utils/auth";
import { db } from "../utils/database";
import { ok, badRequest } from "../utils/responses";
import { Router } from "../utils/router";
import { validateSlug } from "../utils/slug";
import { validClubSlug } from "../utils/validation";

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
  "/:clubId<\\d+>/name",
  validClubId,
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
      return res(badRequest("This slug is already in use by another club"));
    }

    const canUpdate = await ClubRepository.canUpdateSlug(clubId);
    if (!canUpdate) {
      const daysRemaining = await ClubRepository.getDaysUntilSlugUpdate(clubId);
      return res(
        badRequest(
          `You can only change your club slug once every 30 days. Please wait ${daysRemaining} more day(s).`,
        ),
      );
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
