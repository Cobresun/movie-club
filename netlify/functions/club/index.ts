import { Handler, HandlerContext, HandlerEvent } from "@netlify/functions";
import { z } from "zod";

import awardsRouter from "./awards";
import listRouter from "./list";
import membersRouter from "./members";
import reviewsRouter from "./reviews";
import { hasValue } from "../../../lib/checks/checks.js";
import { BaseClub, ClubPreview } from "../../../lib/types/club";
import ClubRepository from "../repositories/ClubRepository";
import WorkRepository from "../repositories/WorkRepository";
import { loggedIn, secured } from "../utils/auth";
import { getFaunaClient } from "../utils/fauna";
import { ok, badRequest } from "../utils/responses";
import { Router } from "../utils/router";
import { Document } from "../utils/types";
import { mapIdToLegacyId, validClubId } from "../utils/validation";

const { faunaClient, q } = getFaunaClient();

const router = new Router("/api/club");
router.use("/:clubId<\\d+>/list", validClubId, listRouter);
router.use("/:clubId<\\d+>/reviews", validClubId, reviewsRouter);
router.use("/:clubId<\\d+>/members", validClubId, membersRouter);
router.use("/:clubId<\\d+>/awards", validClubId, mapIdToLegacyId, awardsRouter);

router.get("/:clubId<\\d+>", validClubId, async ({ clubId }, res) => {
  const club = await ClubRepository.getById(clubId);
  const result: ClubPreview = {
    clubId: club.id,
    clubName: club.name,
  };
  return res(ok(JSON.stringify(result)));
});

const clubCreateSchema = z.object({
  name: z.string(),
  members: z.array(z.string()),
});

router.post("/", loggedIn, async ({ event }, res) => {
  if (!hasValue(event.body)) return res(badRequest("Missing body"));

  const body = clubCreateSchema.safeParse(JSON.parse(event.body));
  if (!body.success) return res(badRequest("Invalid body"));
  const { name, members } = body.data;

  // Generate a random clubId
  const clubId = Math.floor(Math.random() * 100000);

  /**
   * TODO:
   * for member in members:
   *  if they exist in members collection:
   *    get their Ref
   *  else:
   *    make a new document in member for them
   *    get their ref
   **/

  const clubResponse = await faunaClient.query<Document<BaseClub>>(
    q.Create(q.Collection("clubs"), {
      data: {
        clubId: clubId,
        clubName: name,
        members: members,
      },
    }),
  );

  await ClubRepository.insert(name, clubId);

  return res(ok(JSON.stringify(clubResponse.data)));
});

router.get("/:clubId<\\d+>/nextWork", validClubId, async ({ clubId }, res) => {
  const nextWork = await WorkRepository.getNextWork(clubId);
  return res(ok(JSON.stringify({ workId: nextWork?.work_id })));
});

const nextWorkSchema = z.object({
  workId: z.string(),
});

router.put(
  "/:clubId<\\d+>/nextWork",
  validClubId,
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

const handler: Handler = async (
  event: HandlerEvent,
  context: HandlerContext,
) => {
  return router.route({ event, context, params: {} });
};

export { handler };
