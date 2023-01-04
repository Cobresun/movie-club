import {
  HandlerContext,
  HandlerEvent,
  HandlerResponse,
} from "@netlify/functions";
import { Path } from "path-parser";

import { isAuthorized } from "../utils/auth";
import { getFaunaClient } from "../utils/fauna";
import {
  badRequest,
  methodNotAllowed,
  notFound,
  ok,
  unauthorized,
} from "../utils/responses";
import { getWatchlistItemMovieData } from "../utils/tmdb";
import { QueryResponse, StringRecord } from "../utils/types";

import { Club, WatchListViewModel } from "@/common/types/models";

export const path = new Path<StringRecord>(
  "/api/club/:clubId<\\d+>/backlog/:movieId<\\d+>"
);

export async function handler(
  event: HandlerEvent,
  context: HandlerContext,
  path: StringRecord
): Promise<HandlerResponse> {
  const clubId = parseInt(path.clubId);
  if (!(await isAuthorized(clubId, context))) return unauthorized();

  switch (event.httpMethod) {
    case "POST":
      return await addMovieToBacklog(clubId, parseInt(path.movieId));
    case "DELETE":
      return deleteMovieFromBacklog(clubId, parseInt(path.movieId));
    default:
      return methodNotAllowed();
  }
}

async function addMovieToBacklog(clubId: number, movieId: number) {
  const { faunaClient, q } = getFaunaClient();
  const watchListResult = await faunaClient.query<WatchListViewModel>(
    q.Call(q.Function("GetWatchList"), clubId)
  );
  if (watchListResult.backlog.some((item) => item.movieId === movieId)) {
    return badRequest("This movie already exists in the backlog");
  }
  const club = (
    await faunaClient.query<QueryResponse<Club>>(
      q.Call(q.Function("AddMovieToBacklog"), [clubId, movieId])
    )
  ).data;

  const movie = (
    await getWatchlistItemMovieData([club.backlog[club.backlog.length - 1]])
  )[0];

  return ok(JSON.stringify(movie));
}

async function deleteMovieFromBacklog(clubId: number, movieId: number) {
  const { faunaClient, q } = getFaunaClient();
  await faunaClient
    .query(q.Call(q.Function("DeleteBacklogItem"), [clubId, movieId]))
    .catch((error) => {
      notFound(error);
    });

  return ok();
}
