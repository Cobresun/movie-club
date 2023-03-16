import { ExprArg, query } from "faunadb";

import { secured } from "../utils/auth";
import { getClubProperty, getClubRef, getFaunaClient } from "../utils/fauna";
import { badRequest, ok } from "../utils/responses";
import { Router } from "../utils/router";
import { getDetailedMovie } from "../utils/tmdb";
import { QueryResponse, ReviewResponseResponse } from "../utils/types";

import { Club } from "@/common/types/models";

const router = new Router("/api/club/:clubId<\\d+>/reviews");
router.get("/", async (event, context, params) => {
  const clubId = parseInt(params.clubId);
  const { faunaClient, q } = getFaunaClient();

  const reviews = await faunaClient.query<ReviewResponseResponse>(
    q.Call(q.Function("GetClubReviews"), clubId)
  );

  const detailedReviews = await getDetailedMovie(reviews.reviews);
  return ok(JSON.stringify(detailedReviews));
});

router.post("/:movieId<\\d+>", secured, async (event, context, params) => {
  const clubId = parseInt(params.clubId);
  const movieId = parseInt(params.movieId);
  const { faunaClient, q } = getFaunaClient();

  const clubResponse = await faunaClient.query<QueryResponse<Club>>(
    q.Call(q.Function("AddMovieToReviews"), clubId, movieId)
  );

  const updatedReview = (
    await getDetailedMovie([clubResponse.data.reviews[0]])
  )[0];

  return ok(JSON.stringify(updatedReview));
});

router.put("/:movieId<\\d+>", secured, async (event, context, params) => {
  if (event.body == null) return badRequest("Missing body");
  const body = JSON.parse(event.body);
  if (!body.name || !body.score)
    return badRequest("Missing required body parameters");

  const { name, score } = body;
  const clubId = parseInt(params.clubId);
  const movieId = parseInt(params.movieId);
  const { faunaClient, q } = getFaunaClient();

  await faunaClient.query(
    updateReview(
      clubId,
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
});

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
