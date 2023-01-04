import {
  Handler,
  HandlerContext,
  HandlerEvent,
  HandlerResponse,
} from "@netlify/functions";
import { Path } from "path-parser";

import { Club, ClubsViewClub } from "../../../src/common/types/models";
import { isAuthorized } from "../utils/auth";
import { getFaunaClient } from "../utils/fauna";
import {
  ok,
  methodNotAllowed,
  notFound,
  unauthorized,
  badRequest,
} from "../utils/responses";
import { QueryResponse } from "../utils/types";
import { path as backlogPath, handler as backlogHandler } from "./backlog";
import { path as membersPath, handler as membersHandler } from "./members";
import { path as reviewsPath, handler as reviewsHandler } from "./reviews";
import {
  path as watchListPath,
  handler as watchListHandler,
} from "./watchList";

const { faunaClient, q } = getFaunaClient();

type StringRecord = Record<string, string>;

const newClubPath = new Path<StringRecord>("/api/club");

const clubPath = new Path<StringRecord>("/api/club/:clubId<\\d+>");
const nextMoviePath = new Path<StringRecord>(
  "/api/club/:clubId<\\d+>/nextMovie"
);

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

const handler: Handler = async function (
  event: HandlerEvent,
  context: HandlerContext
) {
  const newClubPathMatch = newClubPath.test(event.path);
  if (newClubPathMatch != null) {
    return await newClubHandler(event, context, newClubPathMatch);
  }

  const clubPathMatch = clubPath.partialTest(event.path);
  if (clubPathMatch == null) {
    return notFound("Invalid club id");
  }

  const watchListPathMatch = watchListPath.partialTest(event.path);
  if (watchListPathMatch != null) {
    return await watchListHandler(event, context, watchListPathMatch);
  }

  const membersPathMatch = membersPath.test(event.path);
  if (membersPathMatch != null) {
    return await membersHandler(event, context, membersPathMatch);
  }

  const nextMoviePathMatch = nextMoviePath.test(event.path);
  if (nextMoviePathMatch != null) {
    return await nextMovieHandler(event, context, nextMoviePathMatch);
  }

  const backlogPathMatch = backlogPath.partialTest(event.path);
  if (backlogPathMatch != null) {
    return await backlogHandler(event, context, backlogPathMatch);
  }

  const reviewsPathMatch = reviewsPath.partialTest(event.path);
  if (reviewsPathMatch != null) {
    return await reviewsHandler(event, context, reviewsPathMatch);
  }

  return await getClubHandler(event, context, clubPathMatch);
};

async function getClubHandler(
  event: HandlerEvent,
  context: HandlerContext,
  path: StringRecord
) {
  if (event.httpMethod !== "GET") return methodNotAllowed();

  const club = await faunaClient.query<ClubsViewClub>(
    q.Call(q.Function("GetClub"), parseInt(path.clubId))
  );

  return ok(JSON.stringify(club));
}

async function newClubHandler(
  event: HandlerEvent,
  context: HandlerContext,
  path: StringRecord
) {
  if (!event.body) return badRequest("Missing body");
  const body = JSON.parse(event.body);

  if (!body.name || body.name.length < 1) return badRequest("Missing name");
  const name: string = body.name;

  if (!body.members || !body.members.length)
    return badRequest("Missing members");
  const members: string[] = body.members;

  if (event.httpMethod !== "PUT") return methodNotAllowed();

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
}

async function nextMovieHandler(
  event: HandlerEvent,
  context: HandlerContext,
  path: StringRecord
): Promise<HandlerResponse> {
  const clubId = parseInt(path.clubId);
  if (!(await isAuthorized(clubId, context))) return unauthorized();
  if (event.httpMethod !== "PUT") return methodNotAllowed();
  if (event.body == null) return badRequest("Missing body");

  let movieId: number;
  try {
    movieId = parseInt(JSON.parse(event.body).nextMovieId);
  } catch {
    return badRequest("Invalid movie id");
  }

  await faunaClient.query<void>(
    q.Update(
      q.Select("ref", q.Get(q.Match(q.Index("club_by_clubId"), clubId))),
      {
        data: {
          nextMovieId: movieId,
        },
      }
    )
  );
  return ok();
}

export { handler };
