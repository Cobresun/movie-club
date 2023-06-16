import { secured } from "../utils/auth";
import { getFaunaClient } from "../utils/fauna";
import { ok, badRequest } from "../utils/responses";
import { Router } from "../utils/router";
import { getDetailedMovie } from "../utils/tmdb";
import { QueryResponse } from "../utils/types";
import { ClubRequest } from "../utils/validation";

import { Club } from "@/common/types/club";
import {
  BaseWatchListViewModel,
  WatchListViewModel,
} from "@/common/types/watchlist";

const router = new Router("/api/club/:clubId<\\d+>/watchlist");

router.get("/", async ({ clubId }: ClubRequest) => {
  const { faunaClient, q } = getFaunaClient();

  const watchListViewModel = await faunaClient.query<BaseWatchListViewModel>(
    q.Call(q.Function("GetWatchList"), clubId!)
  );

  const watchListPromise = getDetailedMovie(watchListViewModel.watchList);
  const backlogPromies = getDetailedMovie(watchListViewModel.backlog);

  const [watchList, backlog] = await Promise.all([
    watchListPromise,
    backlogPromies,
  ]);

  return ok(
    JSON.stringify({
      watchList,
      backlog,
      nextMovieId: watchListViewModel.nextMovieId,
    })
  );
});

router.post(
  "/:movieId<\\d+>",
  secured,
  async ({ params, clubId }: ClubRequest) => {
    const movieId = parseInt(params.movieId);
    const { faunaClient, q } = getFaunaClient();
    const watchListResult = await faunaClient.query<WatchListViewModel>(
      q.Call(q.Function("GetWatchList"), clubId!)
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
      await getDetailedMovie([club.watchList[club.watchList.length - 1]])
    )[0];

    return ok(JSON.stringify(movie));
  }
);

router.delete(
  "/:movieId<\\d+>",
  secured,
  async ({ params, clubId }: ClubRequest) => {
    const movieId = parseInt(params.movieId);
    const { faunaClient, q } = getFaunaClient();

    await faunaClient.query(
      q.Call(q.Function("DeleteWatchListItem"), [clubId, movieId])
    );

    return ok();
  }
);

export default router;
