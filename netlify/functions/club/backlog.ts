import { secured } from "../utils/auth";
import { getFaunaClient } from "../utils/fauna";
import { badRequest, notFound, ok } from "../utils/responses";
import { Router } from "../utils/router";
import { getWatchlistItemMovieData } from "../utils/tmdb";
import { QueryResponse } from "../utils/types";

import { Club, WatchListViewModel } from "@/common/types/models";

const router = new Router("/api/club/:clubId<\\d+>/backlog");

router.post("/:movieId<\\d+>", secured, async (event, context, params) => {
  const clubId = parseInt(params.clubId);
  const movieId = parseInt(params.movieId);
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
});

router.delete("/:movieId<\\d+>", secured, async (event, context, params) => {
  const clubId = parseInt(params.clubId);
  const movieId = parseInt(params.movieId);
  const { faunaClient, q } = getFaunaClient();
  try {
    await faunaClient.query(
      q.Call(q.Function("DeleteBacklogItem"), [clubId, movieId])
    );
  } catch (err) {
    return notFound(JSON.stringify(err));
  }

  return ok();
});

export default router;
