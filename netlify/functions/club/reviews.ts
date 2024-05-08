import { ExprArg, query } from "faunadb";

import ReviewRepository from "../repositories/ReviewRepository";
import { securedLegacy } from "../utils/auth";
import { getClubProperty, getClubRef, getFaunaClient } from "../utils/fauna";
import { badRequest, ok } from "../utils/responses";
import { Router } from "../utils/router";
import { getDetailedMovie, getDetailedWorks } from "../utils/tmdb";
import { Document } from "../utils/types";
import { ClubRequest, LegacyClubRequest } from "../utils/validation";

import { BaseClub } from "@/common/types/club";

const router = new Router("/api/club/:clubId<\\d+>/reviews");
// router.get("/", async ({ clubId }: ClubRequest) => {
//   const reviews = await ReviewRepository.getReviewList(clubId);

//   const detailedReviews = await getDetailedWorks(

//   );

//   return ok(JSON.stringify(detailedReviews));
// });

router.post(
  "/:movieId<\\d+>",
  securedLegacy,
  async ({ params, clubId }: LegacyClubRequest) => {
    const movieId = parseInt(params.movieId);
    const { faunaClient, q } = getFaunaClient();

    const clubResponse = await faunaClient.query<Document<BaseClub>>(
      q.Let(
        {
          ref: q.Select(
            "ref",
            q.Get(q.Match(q.Index("club_by_clubId"), clubId!))
          ),
          doc: q.Get(q.Var("ref")),
          array: q.Select(["data", "reviews"], q.Var("doc")),
        },
        q.Update(q.Var("ref"), {
          data: {
            reviews: q.Prepend(
              [
                {
                  movieId: movieId,
                  timeWatched: q.Now(),
                  scores: {},
                },
              ],
              q.Var("array")
            ),
          },
        })
      )
    );

    const updatedReview = (
      await getDetailedMovie([clubResponse.data.reviews[0]])
    )[0];

    return ok(JSON.stringify(updatedReview));
  }
);

router.put(
  "/:movieId<\\d+>",
  securedLegacy,
  async ({ event, params, clubId }: LegacyClubRequest) => {
    if (event.body == null) return badRequest("Missing body");
    const body = JSON.parse(event.body);
    if (!body.name || !body.score)
      return badRequest("Missing required body parameters");

    const { name, score } = body;
    const movieId = parseInt(params.movieId);
    const { faunaClient, q } = getFaunaClient();

    await faunaClient.query(
      updateReview(
        clubId!,
        movieId,
        q.Let(
          {
            average: q.Mean(
              q.Append(
                score,
                q.Map(
                  q.Filter(
                    q.ToArray(q.Select("scores", q.Var("review"))),
                    q.Lambda(
                      "score",
                      q.Let(
                        { scoreKey: q.Select(0, q.Var("score")) },
                        q.Not(
                          q.Or(
                            q.Equals(q.Var("scoreKey"), name),
                            q.Equals(q.Var("scoreKey"), "average")
                          )
                        )
                      )
                    )
                  ),
                  q.Lambda("score", q.Select(1, q.Var("score")))
                )
              )
            ),
          },
          {
            scores: q.Merge(q.Select("scores", q.Var("review")), {
              [name]: score,
              average: q.Var("average"),
            }),
          }
        )
      )
    );
    return ok();
  }
);

function updateReview(clubId: number, movieId: number, expression: ExprArg) {
  const q = query;

  return q.Update(getClubRef(clubId), {
    data: {
      reviews: q.Map(
        getClubProperty(clubId, "reviews"),
        q.Lambda(
          "review",
          q.If(
            q.Equals(q.Select("movieId", q.Var("review")), movieId),
            q.Merge(q.Var("review"), expression),
            q.Var("review")
          )
        )
      ),
    },
  });
}

export default router;
