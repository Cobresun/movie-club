import { type Handler, type HandlerContext, type HandlerEvent } from "@netlify/functions";
import { z } from "zod";

import { hasValue } from "../../lib/checks/checks.js";
import { type ClubPreview } from "../../lib/types/club";
import { type MemberScoredWork } from "../../lib/types/lists";
import ClubRepository from "./repositories/ClubRepository";
import ReviewRepository from "./repositories/ReviewRepository";
import UserRepository from "./repositories/UserRepository";
import { getExternalSummariesForWorks } from "./utils/providers";
import { badRequest, ok } from "./utils/responses";
import { Router } from "./utils/router";
import { loggedIn } from "./utils/session";

const router = new Router("/api/member");

const updateNameSchema = z.object({
  name: z.string().trim().min(1, "Name cannot be empty").max(100, "Name is too long"),
});

router.get("/clubs", loggedIn, async (req, res) => {
  const clubs = await ClubRepository.getClubPreviewsByUserId(req.userId);
  const result: ClubPreview[] = clubs.map((club) => ({
    clubId: club.club_id,
    clubName: club.club_name,
    slug: club.slug,
    slugUpdatedAt: club.slug_updated_at ? String(club.slug_updated_at) : undefined,
    type: club.type,
  }));
  return res(ok<ClubPreview[]>(result));
});

// Every work the member has scored, in any club they belong to. Score Assist
// draws its comparison pool from here so a member reviewing in one club can be
// asked about works they only ever scored in another.
router.get("/scores", loggedIn, async (req, res) => {
  const rows = await ReviewRepository.getScoredWorksByUser(req.userId);
  const externalData = await getExternalSummariesForWorks(
    rows.map((row) => ({ externalId: row.external_id, type: row.type })),
  );

  const result: MemberScoredWork[] = rows.map((row) => ({
    workId: row.work_id,
    clubId: row.club_id,
    clubName: row.club_name,
    clubSlug: row.club_slug,
    type: row.type,
    title: row.title,
    imageUrl: row.image_url ?? undefined,
    externalId: row.external_id ?? undefined,
    externalData: hasValue(row.external_id) ? externalData.get(row.external_id) : undefined,
    score: parseFloat(row.score),
    scoredDate: row.created_date.toISOString(),
  }));
  return res(ok<MemberScoredWork[]>(result));
});

router.put("/name", loggedIn, async (req, res) => {
  const parsed = updateNameSchema.safeParse(JSON.parse(req.event.body ?? "{}"));

  if (!parsed.success) {
    return res(badRequest(parsed.error.errors[0]?.message ?? "Invalid name"));
  }

  const { name } = parsed.data;

  await UserRepository.updateName(req.userId, name);

  return res(ok());
});

const handler: Handler = (event: HandlerEvent, context: HandlerContext) =>
  router.route({ event, context, params: {} });

export { handler };
