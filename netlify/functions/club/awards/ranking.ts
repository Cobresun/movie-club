import { z } from "zod";

import { ClubAwardRequest, updateAward } from "./utils";
import { hasValue } from "../../../../lib/checks/checks.js";
import { securedLegacy } from "../../utils/auth";
import { getFaunaClient } from "../../utils/fauna";
import { badRequest, ok } from "../../utils/responses";
import { Router } from "../../utils/router";

const router = new Router<ClubAwardRequest>(
  "/api/club/:clubId<\\d+>/awards/:year<\\d+>/ranking",
);

const addRankingSchema = z.object({
  awardTitle: z.string(),
  movies: z.array(z.number()),
  voter: z.string(),
});

router.post(
  "/",
  securedLegacy<ClubAwardRequest>,
  async ({ event, clubId, year }, res) => {
    if (!hasValue(event.body)) return res(badRequest("Missing body"));
    const body = addRankingSchema.safeParse(JSON.parse(event.body));
    if (!body.success) return res(badRequest("Invalid body"));

    const { awardTitle, movies, voter } = body.data;

    const moviesWithRanking = movies.map((id, index) => ({
      id,
      rank: index + 1,
    }));

    const { faunaClient, q } = getFaunaClient();

    await faunaClient.query(
      updateAward(
        clubId,
        year,
        awardTitle,
        q.Let(
          {
            movies: moviesWithRanking,
            nominations: q.Select("nominations", q.Var("award")),
          },
          {
            nominations: q.Map(
              q.Var("nominations"),
              q.Lambda(
                "nomination",
                q.Let(
                  {
                    rankingObj: q.Select("ranking", q.Var("nomination")),
                    movieId: q.Select("movieId", q.Var("nomination")),
                    rank: q.Select(
                      [0, "rank"],
                      q.Filter(
                        q.Var("movies"),
                        q.Lambda(
                          "movie",
                          q.Equals(
                            q.Select("id", q.Var("movie")),
                            q.Var("movieId"),
                          ),
                        ),
                      ),
                    ),
                  },
                  q.Merge(q.Var("nomination"), {
                    ranking: q.Merge(q.Var("rankingObj"), {
                      [voter]: q.Var("rank"),
                    }),
                  }),
                ),
              ),
            ),
          },
        ),
      ),
    );

    return res(ok());
  },
);

export default router;
