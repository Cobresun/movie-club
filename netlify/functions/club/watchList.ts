import { WatchListItem, WatchListViewModel } from "@/models";
import {
  HandlerContext,
  HandlerEvent,
  HandlerResponse,
} from "@netlify/functions";
import axios from "axios";
import { Path } from "path-parser";
import { isAuthorized } from "../utils/auth";
import { getFaunaClient } from "../utils/fauna";
import { methodNotAllowed, ok, unauthorized } from "../utils/responses";
import { StringRecord } from "../utils/types";

export const path = new Path<StringRecord>("/api/club/:clubId<\\d+>/watchList");
const modifyPath = new Path<StringRecord>(
  "/api/club/:clubId<\\d+>/watchList/:movieId<\\d+>"
);

const tmdbApiKey = process.env.TMDB_API_KEY;

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

  watchListViewModel.watchList = await getMovieData(
    watchListViewModel.watchList
  );
  watchListViewModel.backlog = await getMovieData(watchListViewModel.backlog);

  return ok(JSON.stringify(watchListViewModel));
}

async function postWatchList(
  clubId: number,
  movieId: number,
  context: HandlerContext
): Promise<HandlerResponse> {
  if (!(await isAuthorized(clubId, context))) return unauthorized();
  const { faunaClient, q } = getFaunaClient();

  await faunaClient.query(
    q.Call(q.Function("AddMovieToWatchList"), [clubId, movieId])
  );

  return ok();
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

async function getMovieData(watchList: WatchListItem[]) {
  const configuration = await axios.get(
    `https://api.themoviedb.org/3/configuration?api_key=${tmdbApiKey}`
  );

  const promises = [];
  for (const movie of watchList) {
    const promise = axios
      .get(
        `https://api.themoviedb.org/3/movie/${movie.movieId}?api_key=${tmdbApiKey}`
      )
      .then((response) => {
        movie.movieTitle = response.data.title;
        movie.releaseDate = response.data.release_date;
        movie.poster_url =
          configuration.data.images.base_url +
          "w500" +
          response.data.poster_path;
      });
    promises.push(promise);
  }

  await Promise.all(promises);
  return watchList;
}
