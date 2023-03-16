import { Handler, HandlerContext, HandlerEvent } from "@netlify/functions";

import { path as awardsPath, handler as awardsHandler } from "./awards";
import { path as backlogPath, handler as backlogHandler } from "./backlog";
import { router as membersRouter } from "./members";
import { router as reviewsRouter } from "./reviews";
import { router as watchlistRouter } from "./watchList";
import { Club, ClubsViewClub } from "../../../src/common/types/models";
import { loggedIn, secured } from "../utils/auth";
import { getClubRef, getFaunaClient } from "../utils/fauna";
import { ok, badRequest } from "../utils/responses";
import { Router } from "../utils/router";
import { QueryResponse } from "../utils/types";

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
router.use("/:clubId<\\d+>/reviews", reviewsRouter);
router.use("/:clubId<\\d+>/watchlist", watchlistRouter);
router.use("/:clubId<\\d+>/members", membersRouter);

router.get("/:clubId<\\d+>", async (event, context, params) => {
  const club = await faunaClient.query<ClubsViewClub>(
    q.Call(q.Function("GetClub"), parseInt(params.clubId))
  );

  return ok(JSON.stringify(club));
});

router.post("/", loggedIn, async (event) => {
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

  const clubResponse = await faunaClient.query<QueryResponse<Club>>(
    q.Create(q.Collection("clubs"), {
      data: {
        clubId: clubId,
        clubName: name,
        members: members,
      },
    })
  );

  return ok(JSON.stringify(clubResponse.data));
});

router.put(
  "/:clubId<\\d+>/nextMovie",
  secured,
  async (event, context, params) => {
    const clubId = parseInt(params.clubId);
    if (!event.body) return badRequest("Missing body");
    let movieId: number;
    try {
      movieId = parseInt(JSON.parse(event.body).nextMovieId);
    } catch {
      return badRequest("Invalid movie id");
    }

    await faunaClient.query(
      q.Update(getClubRef(clubId), {
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
  return router.route(event, context);
};

const otherHandler: Handler = async function (
  event: HandlerEvent,
  context: HandlerContext
) {
  const backlogPathMatch = backlogPath.partialTest(event.path);
  if (backlogPathMatch != null) {
    return await backlogHandler(event, context, backlogPathMatch);
  }

  const awardsPathMatch = awardsPath.partialTest(event.path);
  if (awardsPathMatch != null) {
    return await awardsHandler(event, context, awardsPathMatch);
  }
};

export { handler };
