import {
  HandlerEvent,
  HandlerContext,
  HandlerResponse,
} from "@netlify/functions";
import { Path } from "path-parser";

import { isAuthorized } from "../utils/auth";
import { getFaunaClient } from "../utils/fauna";
import { badRequest, ok } from "../utils/responses";
import { unauthorized, methodNotAllowed } from "../utils/responses";
import { getDetailedMovie } from "../utils/tmdb";
import {
  StringRecord,
  QueryResponse,
  ReviewResponseResponse,
} from "../utils/types";

import { Club, ReviewResponse } from "@/common/types/models";

export const path = new Path<StringRecord>("/api/club/:clubId<\\d+>/reviews");
const modifyPath = new Path<StringRecord>(
  "/api/club/:clubId<\\d+>/reviews/:movieId<\\d+>"
);

export async function handler(
  event: HandlerEvent,
  context: HandlerContext,
  _path: StringRecord
): Promise<HandlerResponse> {
  const modifyPathParam = modifyPath.test(event.path);
  const path = modifyPathParam == null ? _path : modifyPathParam;
  const clubId = parseInt(path.clubId);

  switch (event.httpMethod) {
    case "GET": {
      const detailed = event.queryStringParameters?.detailed === "true";
      return await getReviews(clubId, detailed);
    }
    case "POST":
      if (!(await isAuthorized(clubId, context))) return unauthorized();
      return await postReview(parseInt(path.clubId), parseInt(path.movieId));
    case "PUT": {
      if (!(await isAuthorized(clubId, context))) return unauthorized();
      if (event.body == null) return badRequest("Missing body");
      const body = JSON.parse(event.body);
      if (!body.name || !body.score)
        return badRequest("Missing required body parameters");

      return await updateReviewScore(
        clubId,
        parseInt(path.movieId),
        body.name,
        body.score
      );
    }
    default:
      return methodNotAllowed();
  }
}

// TODO: GetClubReviews needs to return them sorted
async function getReviews(
  clubId: number,
  detailed: boolean
): Promise<HandlerResponse> {
  const { faunaClient, q } = getFaunaClient();

  const reviews = await faunaClient.query<ReviewResponseResponse>(
    q.Call(q.Function("GetClubReviews"), clubId)
  );

  const detailedReviews = await getDetailedMovie(reviews.reviews);
  return ok(JSON.stringify(detailedReviews));
}

async function postReview(
  clubId: number,
  movieId: number
): Promise<HandlerResponse> {
  const { faunaClient, q } = getFaunaClient();

  const clubResponse = await faunaClient.query<QueryResponse<Club>>(
    q.Call(q.Function("AddMovieToReviews"), clubId, movieId)
  );

  const updatedReview = (
    await getDetailedMovie([clubResponse.data.reviews[0]])
  )[0];

  return ok(JSON.stringify(updatedReview));
}

async function updateReviewScore(
  clubId: number,
  movieId: number,
  userName: string,
  score: number
): Promise<HandlerResponse> {
  const { faunaClient, q } = getFaunaClient();

  const reviewResponse = await faunaClient.query<ReviewResponse[]>(
    q.Call(q.Function("GetReviewByMovieId"), clubId, movieId)
  );

  const review = reviewResponse[0];

  review.scores[userName] = score;

  // TODO: average should just be calculated in the client...
  if (review.scores["average"] === undefined) {
    // If no existing average, set the average to the current review's score
    review.scores["average"] = score;
  } else {
    const numberOfScores = Object.keys(review.scores).length - 1;
    review.scores["average"] = 0;

    Object.keys(review.scores)
      .filter((user) => user !== "average")
      .map((user) => (review.scores.average += review.scores[user]));

    review.scores["average"] = review.scores["average"] / numberOfScores;
  }

  await faunaClient.query(
    q.Call(q.Function("DeleteReviewByMovieId"), clubId, movieId)
  );

  await faunaClient.query(q.Call(q.Function("AddReview"), clubId, review));

  return ok(JSON.stringify((await getDetailedMovie([review]))[0]));
}
