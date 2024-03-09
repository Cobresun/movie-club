import { Handler, HandlerContext, HandlerEvent } from "@netlify/functions";

import awardsRouter from "./awards";
import backlogRouter from "./backlog";
import membersRouter from "./members";
import reviewsRouter from "./reviews";
import watchlistRouter from "./watchList";
import ClubRepository from "../repositories/ClubRepository";
import { loggedIn, securedLegacy } from "../utils/auth";
import { getClubRef, getFaunaClient } from "../utils/fauna";
import { ok, badRequest } from "../utils/responses";
import { Router } from "../utils/router";
import { Document } from "../utils/types";
import type { ClubRequest, LegacyClubRequest } from "../utils/validation";
import { mapIdToLegacyId, validClubId } from "../utils/validation";

import { BaseClub, ClubPreview } from "@/common/types/club";

const { faunaClient, q } = getFaunaClient();

/**
 * PUT /club -> ClubsViewClub
 *
 * GET /club/:clubId -> ClubsViewClub
 * GET /club/:clubId/members -> Member[]
 * GET /club/:clubId/reviews/:detailed -> DetailedReviewResponse || ReviewResponse (where detailed is a boolean)
 *
 * Next Movie:
 * PUT /club/:clubId/nextMovie
 * body {
 *  nextMovieId: number
 * }
 *
 * Backlog:
 * POST /club/:clubId/backlog/:movieId
 * DELETE /club/:clubId/backlog/:movieId
 *
 * Watchlist:
 * GET /club/:clubId/watchList -> WatchListViewModel
 * POST /club/:clubId/watchList/:movieId
 * DELETE /club/:clubId/watchList/:movieId
 *
 * Reviews:
 * GET /club/:clubId/reviews?detailed={}
 * POST /club/:clubId/reviews/:movieId
 * PUT /club/:clubId/reviews/:movieId
 * body {
 *  name: string,
 *  score: number,
 * }
 */

const router = new Router("/api/club");
router.use(
  "/:clubId<\\d+>/reviews",
  validClubId,
  mapIdToLegacyId,
  reviewsRouter
);
router.use(
  "/:clubId<\\d+>/watchlist",
  validClubId,
  mapIdToLegacyId,
  watchlistRouter
);
router.use("/:clubId<\\d+>/backlog", validClubId, backlogRouter);
router.use("/:clubId<\\d+>/members", validClubId, membersRouter);
router.use("/:clubId<\\d+>/awards", validClubId, mapIdToLegacyId, awardsRouter);

router.get("/:clubId<\\d+>", validClubId, async ({ clubId }: ClubRequest) => {
  const club = await ClubRepository.getById(clubId!);
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
    })
  );

  await ClubRepository.insert(name, clubId);

  return ok(JSON.stringify(clubResponse.data));
});

router.put(
  "/:clubId<\\d+>/nextMovie",
  validClubId,
  mapIdToLegacyId,
  securedLegacy,
  async ({ event, clubId }: LegacyClubRequest) => {
    if (!event.body) return badRequest("Missing body");
    let movieId: number;
    try {
      movieId = parseInt(JSON.parse(event.body).nextMovieId);
    } catch {
      return badRequest("Invalid movie id");
    }

    await faunaClient.query(
      q.Update(getClubRef(clubId!), {
        data: {
          nextMovieId: movieId,
        },
      })
    );
    return ok();
  }
);

const handler: Handler = async (
  event: HandlerEvent,
  context: HandlerContext
) => {
  return router.route({ event, context });
};

export { handler };
