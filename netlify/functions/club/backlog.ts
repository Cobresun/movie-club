import { secured } from "../utils/auth";
import { getClubProperty, getClubRef, getFaunaClient } from "../utils/fauna";
import { badRequest, notFound, ok } from "../utils/responses";
import { Router } from "../utils/router";
import { getDetailedMovie } from "../utils/tmdb";
import { Document } from "../utils/types";
import { ClubRequest } from "../utils/validation";

import { BaseClub } from "@/common/types/club";
import { WatchListViewModel } from "@/common/types/watchlist";

const router = new Router("/api/club/:clubId<\\d+>/backlog");

router.post(
  "/:movieId<\\d+>",
  secured,
  async ({ params, clubId }: ClubRequest) => {
    const movieId = parseInt(params.movieId);
    const { faunaClient, q } = getFaunaClient();

    const watchListResult = await faunaClient.query<WatchListViewModel>(
      q.Let(
        {
          clubDoc: q.Get(q.Match(q.Index("club_by_clubId"), clubId!))
        },
        {
          watchList: q.Select(["data", "watchList"], q.Var("clubDoc")),
          backlog: q.Select(["data", "backlog"], q.Var("clubDoc")),
          nextMovieId: q.Select(["data", "nextMovieId"], q.Var("clubDoc"))
        }
      )
    );

    if (watchListResult.backlog.some((item) => item.movieId === movieId)) {
      return badRequest("This movie already exists in the backlog");
    }

    const club = (
      await faunaClient.query<Document<BaseClub>>(
        q.Update(getClubRef(clubId!), {
          data: {
            backlog: q.Append(
              [{ movieId, timeAdded: q.Now() }],
              getClubProperty(clubId!, "backlog")
            ),
          },
        })
      )
    ).data;

    const movie = (
      await getDetailedMovie([club.backlog[club.backlog.length - 1]])
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
    try {
      await faunaClient.query(
        q.Let(
          {
            clubRef: q.Select(
              "ref",
              q.Get(q.Match(q.Index("club_by_clubId"), clubId!))
            )
          },
          q.Update(q.Var("clubRef"), {
            data: {
              backlog: q.Filter(
                q.Select(["data", "backlog"], q.Get(q.Var("clubRef"))),
                q.Lambda(
                  "backlogItem",
                  q.Not(q.Equals(movieId, q.Select(["movieId"], q.Var("backlogItem"))))
                )
              )
            }
          })
        )
      );
    } catch (err) {
      return notFound(JSON.stringify(err));
    }

    return ok();
  }
);

export default router;
