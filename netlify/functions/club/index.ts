import { Handler, HandlerContext, HandlerEvent } from "@netlify/functions";

import awardsRouter from "./awards";
import listRouter from "./list";
import membersRouter from "./members";
import reviewsRouter from "./reviews";
import ClubRepository from "../repositories/ClubRepository";
import WorkRepository from "../repositories/WorkRepository";
import { loggedIn, secured } from "../utils/auth";
import { getFaunaClient } from "../utils/fauna";
import { ok, badRequest } from "../utils/responses";
import { Router } from "../utils/router";
import { Document } from "../utils/types";
import type { ClubRequest } from "../utils/validation";
import { mapIdToLegacyId, validClubId } from "../utils/validation";

import { BaseClub, ClubPreview } from "@/common/types/club";

const { faunaClient, q } = getFaunaClient();

const router = new Router("/api/club");
router.use("/:clubId<\\d+>/list", validClubId, listRouter);
router.use("/:clubId<\\d+>/reviews", validClubId, reviewsRouter);
router.use("/:clubId<\\d+>/members", validClubId, membersRouter);
router.use("/:clubId<\\d+>/awards", validClubId, mapIdToLegacyId, awardsRouter);

router.get("/:clubId<\\d+>", validClubId, async ({ clubId }: ClubRequest) => {
  const club = await ClubRepository.getById(clubId);
  const result: ClubPreview = {
    clubId: club.id,
    clubName: club.name,
  };
  return ok(JSON.stringify(result));
});

router.post("/", loggedIn, async ({ event }) => {
  if (!event.body) return badRequest("Missing body");
  const body = JSON.parse(event.body);
  if (!body.name || body.name.length < 1) return badRequest("Missing name");
  if (!body.members || !body.members.length)
    return badRequest("Missing members");

  const name: string = body.name;
  const members: string[] = body.members;

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

  return ok(JSON.stringify(clubResponse.data));
});

router.get(
  "/:clubId<\\d+>/nextWork",
  validClubId,
  async ({ clubId }: ClubRequest) => {
    const nextWork = await WorkRepository.getNextWork(clubId);
    return ok(JSON.stringify({ workId: nextWork?.work_id }));
  },
);

router.put(
  "/:clubId<\\d+>/nextWork",
  validClubId,
  secured,
  async ({ event, clubId }: ClubRequest) => {
    if (!event.body) return badRequest("Missing body");
    const body = JSON.parse(event.body);
    if (!body.workId) return badRequest("Missing workId");

    await WorkRepository.deleteNextWork(clubId);
    await WorkRepository.setNextWork(clubId, body.workId);

    return ok();
  },
);

const handler: Handler = async (
  event: HandlerEvent,
  context: HandlerContext,
) => {
  return router.route({ event, context });
};

export { handler };
