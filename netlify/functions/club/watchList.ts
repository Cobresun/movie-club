import { Club, WatchListViewModel } from "@/common/types/models";
import { HandlerContext, HandlerEvent, HandlerResponse } from "@netlify/functions";
import { Path } from "path-parser";
import { isAuthorized } from "../utils/auth";
import { getFaunaClient } from "../utils/fauna";
import { methodNotAllowed, ok, unauthorized } from "../utils/responses";
import { getWatchlistItemMovieData } from "../utils/tmdb";
import { StringRecord, QueryResponse } from "../utils/types";

export const path = new Path<StringRecord>("/api/club/:clubId<\\d+>/watchList");
const modifyPath = new Path<StringRecord>(
  "/api/club/:clubId<\\d+>/watchList/:movieId<\\d+>"
);

export async function handler(
  event: HandlerEvent,
  context: HandlerContext,
  _path: StringRecord
): Promise<HandlerResponse> {
  const modifyPathParam = modifyPath.test(event.path);
  const path = modifyPathParam == null ? _path : modifyPathParam;
  const clubId = parseInt(path.clubId);

  switch (event.httpMethod) {
    case "GET":
      return await getWatchList(clubId);
    case "POST":
      return await postWatchList(
        parseInt(path.clubId),
        parseInt(path.movieId),
        context
      );
    case "DELETE":
      return await deleteWatchList(
        parseInt(path.clubId),
        parseInt(path.movieId),
        context
      );
    default:
      return methodNotAllowed();
  }
}

async function getWatchList(clubId: number): Promise<HandlerResponse> {
  const { faunaClient, q } = getFaunaClient();
  const watchListViewModel = await faunaClient.query<WatchListViewModel>(
    q.Call(q.Function("GetWatchList"), clubId)
  );

  watchListViewModel.watchList = await getWatchlistItemMovieData(watchListViewModel.watchList);
  watchListViewModel.backlog = await getWatchlistItemMovieData(watchListViewModel.backlog);

  return ok(JSON.stringify(watchListViewModel));
}

async function postWatchList(
  clubId: number,
  movieId: number,
  context: HandlerContext
): Promise<HandlerResponse> {
  if (!(await isAuthorized(clubId, context))) return unauthorized();
  const { faunaClient, q } = getFaunaClient();

  const club = (
    await faunaClient.query<QueryResponse<Club>>(
      q.Call(q.Function("AddMovieToWatchList"), [clubId, movieId])
    )
  ).data;

  const movie = (await getWatchlistItemMovieData([club.watchList[club.watchList.length - 1]]))[0];

  return ok(JSON.stringify(movie));
}

async function deleteWatchList(
  clubId: number,
  movieId: number,
  context: HandlerContext
): Promise<HandlerResponse> {
  if (!(await isAuthorized(clubId, context))) return unauthorized();
  const { faunaClient, q } = getFaunaClient();

  await faunaClient.query(
    q.Call(q.Function("DeleteWatchListItem"), [clubId, movieId])
  );

  return ok();
}
