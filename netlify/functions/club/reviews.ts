import {
  ReviewResponse,
  DetailedReviewResponse,
  Club,
  DateObject,
} from "@/models";
import {
  HandlerEvent,
  HandlerContext,
  HandlerResponse,
} from "@netlify/functions";
import { badRequest, ok } from "../utils/responses";
import { isAuthorized } from "../utils/auth";
import { unauthorized, methodNotAllowed } from "../utils/responses";
import { StringRecord, QueryResponse } from "../utils/types";
import { getFaunaClient } from "../utils/fauna";
import axios from "axios";
import { Path } from "path-parser";

export const path = new Path<StringRecord>("/api/club/:clubId<\\d+>/reviews");
const modifyPath = new Path<StringRecord>(
  "/api/club/:clubId<\\d+>/reviews/:movieId<\\d+>"
);

const tmdbApiKey = process.env.TMDB_API_KEY;
// TODO: Don't really want this to exist, update Fauna function
export interface ReviewResponseResponse {
  reviews: ReviewDatabaseObject[];
}

interface ReviewDatabaseObject {
  movieId: number;
  timeWatched: DateObject;
  scores: Record<string, number>;
  postReviewScores: Record<string, number>;
}

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
        body.score,
        event.queryStringParameters?.isPostReviewScores == "true"
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

  if (detailed) {
    const detailedReviews = await getDetailedMovieData(
      reviews.reviews as DetailedReviewResponse[]
    );
    return ok(JSON.stringify(detailedReviews));
  } else {
    reviews.reviews = await getReviewData(reviews.reviews);
    return ok(JSON.stringify(reviews.reviews));
  }
}

async function postReview(
  clubId: number,
  movieId: number
): Promise<HandlerResponse> {
  const { faunaClient, q } = getFaunaClient();

  const clubResponse = await faunaClient.query<QueryResponse<Club>>(
    q.Call(q.Function("AddMovieToReviews"), clubId, movieId)
  );

  clubResponse.data.reviews = await getReviewData(clubResponse.data.reviews);

  return ok(JSON.stringify(clubResponse.data.reviews[0]));
}

async function updateReviewScore(
  clubId: number,
  movieId: number,
  userName: string,
  score: number,
  postReviewScores: boolean = false
): Promise<HandlerResponse> {
  const { faunaClient, q } = getFaunaClient();

  const reviewResponse = await faunaClient.query<ReviewDatabaseObject[]>(
    q.Call(q.Function("GetReviewByMovieId"), clubId, movieId)
  );

  const review = reviewResponse[0];

  let scores = postReviewScores ? review.postReviewScores : review.scores;

  scores[userName] = score;

  // TODO: average should just be calculated in the client...
  if (scores["average"] === undefined) {
    // If no existing average, set the average to the current review's score
    scores["average"] = score;
  } else {
    const numberOfScores = Object.keys(scores).length - 1;
    scores["average"] = 0;

    Object.keys(scores)
      .filter((user) => user !== "average")
      .map((user) => (scores.average += scores[user]));

    scores["average"] = scores["average"] / numberOfScores;
  }

  await faunaClient.query(
    q.Call(q.Function("DeleteReviewByMovieId"), clubId, movieId)
  );

  await faunaClient.query(q.Call(q.Function("AddReview"), clubId, review));

  return ok(JSON.stringify((await getReviewData([review]))[0]));
}

async function getReviewData(reviews: ReviewDatabaseObject[]) {
  const promises: Promise<ReviewResponse>[] = [];
  for (const movie of reviews) {
    const promise = axios
      .get(
        `https://api.themoviedb.org/3/movie/${movie.movieId}?api_key=${tmdbApiKey}`
      )
      .then((response) => ({
        ...movie,
        movieTitle: response.data.title,
      }));
    promises.push(promise);
  }

  return await Promise.all(promises);
}

async function getDetailedMovieData(reviews: DetailedReviewResponse[]) {
  const promises = [];

  const configuration = await axios.get(
    `https://api.themoviedb.org/3/configuration?api_key=${tmdbApiKey}`
  );

  for (const movie of reviews) {
    const promise = axios
      .get(
        `https://api.themoviedb.org/3/movie/${movie.movieId}?api_key=${tmdbApiKey}`
      )
      .then((response) => {
        movie.movieTitle = response.data.title;
        movie.movieData = response.data;
        movie.movieData.poster_url = `${configuration.data.images.secure_base_url}w154${response.data.poster_path}`;
      });
    promises.push(promise);
  }

  await Promise.all(promises);
  return reviews;
}
