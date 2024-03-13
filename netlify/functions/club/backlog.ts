import ListRepository from "../repositories/ListRepository";
import WorkRepository from "../repositories/WorkRepository";
import { securedLegacy, secured } from "../utils/auth";
import { getClubProperty, getClubRef, getFaunaClient } from "../utils/fauna";
import {
  badRequest,
  internalServerError,
  notFound,
  ok,
} from "../utils/responses";
import { Router } from "../utils/router";
import { getDetailedMovie } from "../utils/tmdb";
import { Document } from "../utils/types";
import { ClubRequest, LegacyClubRequest } from "../utils/validation";

import { BaseClub } from "@/common/types/club";
import { WatchListViewModel } from "@/common/types/watchlist";

const router = new Router("/api/club/:clubId<\\d+>/backlog");

router.delete(
  "/:movieId<\\d+>",
  securedLegacy,
  async ({ params, clubId }: LegacyClubRequest) => {
    const movieId = parseInt(params.movieId);
    const { faunaClient, q } = getFaunaClient();
    try {
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
              backlog: q.Filter(
                q.Select(["data", "backlog"], q.Get(q.Var("clubRef"))),
                q.Lambda(
                  "backlogItem",
                  q.Not(
                    q.Equals(
                      movieId,
                      q.Select(["movieId"], q.Var("backlogItem"))
                    )
                  )
                )
              ),
            },
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
