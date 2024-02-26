import { secured } from "../utils/auth";
import { getFaunaClient } from "../utils/fauna";
import { ok, badRequest } from "../utils/responses";
import { Router } from "../utils/router";
import { getDetailedMovie } from "../utils/tmdb";
import { Document } from "../utils/types";
import { LegacyClubRequest } from "../utils/validation";

import { BaseClub } from "@/common/types/club";
import {
  BaseWatchListViewModel,
  WatchListViewModel,
} from "@/common/types/watchlist";

const router = new Router("/api/club/:clubId<\\d+>/watchlist");

router.get("/", async ({ clubId }: LegacyClubRequest) => {
  const { faunaClient, q } = getFaunaClient();

  const watchListViewModel = await faunaClient.query<BaseWatchListViewModel>(
    q.Let(
      {
        clubDoc: q.Get(q.Match(q.Index("club_by_clubId"), clubId!)),
      },
      {
        watchList: q.Select(["data", "watchList"], q.Var("clubDoc")),
        backlog: q.Select(["data", "backlog"], q.Var("clubDoc")),
        nextMovieId: q.Select(["data", "nextMovieId"], q.Var("clubDoc")),
      }
    )
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
  async ({ params, clubId }: LegacyClubRequest) => {
    const movieId = parseInt(params.movieId);
    const { faunaClient, q } = getFaunaClient();

    const watchListResult = await faunaClient.query<WatchListViewModel>(
      q.Let(
        {
          clubDoc: q.Get(q.Match(q.Index("club_by_clubId"), clubId!)),
        },
        {
          watchList: q.Select(["data", "watchList"], q.Var("clubDoc")),
          backlog: q.Select(["data", "backlog"], q.Var("clubDoc")),
          nextMovieId: q.Select(["data", "nextMovieId"], q.Var("clubDoc")),
        }
      )
    );

    if (watchListResult.watchList.some((item) => item.movieId === movieId)) {
      return badRequest("This movie already exists in the watchlist");
    }

    const club = (
      await faunaClient.query<Document<BaseClub>>(
        q.Let(
          {
            ref: q.Select(
              "ref",
              q.Get(q.Match(q.Index("club_by_clubId"), clubId!))
            ),
            doc: q.Get(q.Var("ref")),
            array: q.Select(["data", "watchList"], q.Var("doc")),
            updatedArray: q.Prepend(
              [{ movieId: movieId, timeAdded: q.Now() }],
              q.Var("array")
            ),
          },
          q.Update(q.Var("ref"), { data: { watchList: q.Var("updatedArray") } })
        )
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
  async ({ params, clubId }: LegacyClubRequest) => {
    const movieId = parseInt(params.movieId);
    const { faunaClient, q } = getFaunaClient();

    await faunaClient.query(
      q.Let(
        {
          clubRef: q.Select(
            "ref",
            q.Get(q.Match(q.Index("club_by_clubId"), clubId!))
          ),
        },
        q.Update(q.Var("clubRef"), {
          data: {
            watchList: q.Filter(
              q.Select(["data", "watchList"], q.Get(q.Var("clubRef"))),
              q.Lambda(
                "watchListItem",
                q.Not(
                  q.Equals(
                    movieId,
                    q.Select(["movieId"], q.Var("watchListItem"))
                  )
                )
              )
            ),
          },
        })
      )
    );

    return ok();
  }
);

export default router;
