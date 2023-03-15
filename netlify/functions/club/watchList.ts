import { secured } from "../utils/auth";
import { getFaunaClient } from "../utils/fauna";
import { ok, badRequest } from "../utils/responses";
import { Router } from "../utils/router";
import { getWatchlistItemMovieData } from "../utils/tmdb";
import { QueryResponse } from "../utils/types";

import { Club, WatchListViewModel } from "@/common/types/models";

const router = new Router("/api/club/:clubId<\\d+>/watchlist");

router.get("/", async (event, context, params) => {
  const clubId = parseInt(params.clubId);
  const { faunaClient, q } = getFaunaClient();

  const watchListViewModel = await faunaClient.query<WatchListViewModel>(
    q.Call(q.Function("GetWatchList"), clubId)
  );

  watchListViewModel.watchList = await getWatchlistItemMovieData(
    watchListViewModel.watchList
  );
  watchListViewModel.backlog = await getWatchlistItemMovieData(
    watchListViewModel.backlog
  );

  return ok(JSON.stringify(watchListViewModel));
});

router.post("/:movieId<\\d+>", secured, async (event, context, params) => {
  const clubId = parseInt(params.clubId);
  const movieId = parseInt(params.movieId);
  const { faunaClient, q } = getFaunaClient();
  const watchListResult = await faunaClient.query<WatchListViewModel>(
    q.Call(q.Function("GetWatchList"), clubId)
  );
  if (watchListResult.watchList.some((item) => item.movieId === movieId)) {
    return badRequest("This movie already exists in the watchlist");
  }

  const club = (
    await faunaClient.query<QueryResponse<Club>>(
      q.Call(q.Function("AddMovieToWatchList"), [clubId, movieId])
    )
  ).data;

  const movie = (
    await getWatchlistItemMovieData([club.watchList[club.watchList.length - 1]])
  )[0];

  return ok(JSON.stringify(movie));
});

router.delete("/:movieId<\\d+>", secured, async (event, context, params) => {
  const clubId = parseInt(params.clubId);
  const movieId = parseInt(params.movieId);
  const { faunaClient, q } = getFaunaClient();

  await faunaClient.query(
    q.Call(q.Function("DeleteWatchListItem"), [clubId, movieId])
  );

  return ok();
});

export { router };
