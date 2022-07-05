import { Handler, HandlerContext, HandlerEvent, HandlerResponse } from "@netlify/functions"
import faunadb from "faunadb"
import { Club, ClubsViewClub, DetailedReviewResponse, Member, ReviewResponse, WatchListItem, WatchListViewModel } from "../../src/models"
import axios from "axios"
import { Path } from "path-parser";
import { ok, methodNotAllowed, notFound, unauthorized, badRequest } from "./utils/responses"
import { QueryResponse } from "./utils/types";

const faunaClient = new faunadb.Client({ secret: process.env.FAUNADB_SERVER_SECRET ?? "" })
const q = faunadb.query

const tmdbApiKey = process.env.TMDB_API_KEY

type StringRecord = Record<string, string>

const clubPath = new Path<StringRecord>('/api/club/:clubId<\\d+>')
const watchListPath = new Path<StringRecord>('/api/club/:clubId<\\d+>/watchList')
const postWatchListPath = new Path<StringRecord>('/api/club/:clubId<\\d+>/watchList/:movieId<\\d+>')
const membersPath = new Path<StringRecord>('/api/club/:clubId<\\d+>/members')
const nextMoviePath = new Path<StringRecord>('/api/club/:clubId<\\d+>/nextMovie')
const backlogPath = new Path<StringRecord>('/api/club/:clubId<\\d+>/backlog/:movieId<\\d+>')
const reviewsPath = new Path<StringRecord>('/api/club/:clubId<\\d+>/reviews')
const modifyReviewsPath = new Path<StringRecord>('/api/club/:clubId<\\d+>/reviews/:movieId<\\d+>')

/**
 * GET /club/:clubId -> ClubsViewClub
 * GET /club/:clubId/members -> Member[]
 * GET /club/:clubId/reviews/:detailed -> DetailedReviewResponse || ReviewResponse (where detailed is a boolean)
 * 
 * Next Movie:
 * PUT /club/:clubId/nextMovie
 * body {
 *  nextMovieId: number
 * }
 * 
 * Backlog:
 * POST /club/:clubId/backlog/:movieId
 * DELETE /club/:clubId/backlog/:movieId
 * 
 * Watchlist:
 * GET /club/:clubId/watchList -> WatchListViewModel
 * POST /club/:clubId/watchList/:movieId
 * 
 * Reviews:
 * GET /club/:clubId/reviews?detailed=false
 * GET /club/:clubId/reviews?detailed=true
 * POST /club/:clubId/reviews/:movieId
 */

const handler: Handler = async function(event: HandlerEvent, context: HandlerContext) {
    const clubPathMatch = clubPath.partialTest(event.path);
    if (clubPathMatch == null) {
        return notFound("Invalid club id");
    }

    const postWatchListPathMatch = postWatchListPath.test(event.path);
    if (postWatchListPathMatch != null) {
        return await postWatchListHandler(event, context, postWatchListPathMatch)
    }

    const watchListPathMatch = watchListPath.test(event.path);
    if (watchListPathMatch != null) {
        return await watchListHandler(event, context, watchListPathMatch)
    }

    const membersPathMatch = membersPath.test(event.path);
    if (membersPathMatch != null) {
        return await membersHandler(event, context, membersPathMatch)
    }

    const nextMoviePathMatch = nextMoviePath.test(event.path);
    if (nextMoviePathMatch != null) {
        return await nextMovieHandler(event, context, nextMoviePathMatch)
    }

    const backlogPathMatch = backlogPath.partialTest(event.path);
    if (backlogPathMatch != null) {
        return await backlogHandler(event, context, backlogPathMatch);
    }

    const modifyReviewsPathMatch = modifyReviewsPath.partialTest(event.path);
    if (modifyReviewsPathMatch != null) {
        return await reviewsHandler(event, context, modifyReviewsPathMatch);
    }

    const reviewsPathMatch = reviewsPath.partialTest(event.path);
    if (reviewsPathMatch != null) {
        return await reviewsHandler(event, context, reviewsPathMatch);
    }

    return await getClubHandler(event, context, clubPathMatch);
}

async function getClubHandler(event: HandlerEvent, context: HandlerContext, path: StringRecord) {
    if (event.httpMethod !== 'GET') return methodNotAllowed();

    const club = await faunaClient.query<ClubsViewClub>(
        q.Call(q.Function("GetClub"), parseInt(path.clubId))
    )

    return ok(JSON.stringify(club)) 
}

async function postWatchListHandler(event: HandlerEvent, context: HandlerContext, path: StringRecord): Promise<HandlerResponse> {
    // TODO: Commented out because it wasn't working, but idk why
    // if (!isAuthorized(context)) return unauthorized()

    if (event.httpMethod !== 'POST') return methodNotAllowed()

    await faunaClient.query(
        q.Call(q.Function("AddMovieToWatchList"), [parseInt(path.clubId), parseInt(path.movieId)])
    )

    return ok()
}

async function watchListHandler(event: HandlerEvent, context: HandlerContext, path: StringRecord): Promise<HandlerResponse> {
    if (event.httpMethod !== 'GET') return methodNotAllowed()
    
    const watchListViewModel = await faunaClient.query<WatchListViewModel>(
        q.Call(q.Function("GetWatchList"), parseInt(path.clubId))
    )

    watchListViewModel.watchList = await getMovieData(watchListViewModel.watchList)
    watchListViewModel.backlog = await getMovieData(watchListViewModel.backlog)

    return ok(JSON.stringify(watchListViewModel))
}

// TODO: Don't really want this to exist, update Fauna function
export interface MembersResponse {
    members: Member[];
}

async function membersHandler(event: HandlerEvent, context: HandlerContext, path: StringRecord): Promise<HandlerResponse> {
    if (event.httpMethod !== 'GET') return methodNotAllowed();

    const clubId = parseInt(path.clubId)

    const members = await faunaClient.query<MembersResponse>(
        q.Call(q.Function("GetClubMembers"), clubId)
    )

    return ok(JSON.stringify(members.members))
}

async function nextMovieHandler(event: HandlerEvent, context: HandlerContext, path: StringRecord): Promise<HandlerResponse> {
    if (!isAuthorized(context)) return unauthorized();
    if (event.httpMethod !== 'PUT') return methodNotAllowed();
    if (event.body == null) return badRequest('Missing body');

    let movieId: number;
    try {
        movieId = parseInt(JSON.parse(event.body).nextMovieId);
    } catch {
        return badRequest("Invalid movie id");
    }

    await faunaClient.query<void>(
        q.Update(
            q.Select("ref", q.Get(q.Match(q.Index("club_by_clubId"), parseInt(path.clubId)))),
            {
                data: {
                    nextMovieId: movieId
                }
            }
        )
    )
    return ok();
}

async function backlogHandler(event: HandlerEvent, context: HandlerContext, path: StringRecord): Promise<HandlerResponse> {
    if (!isAuthorized(context)) return unauthorized()

    switch(event.httpMethod) {
        case "POST":
            return await addMovieToBacklog(parseInt(path.clubId), parseInt(path.movieId))
        case "DELETE":
            return deleteMovieFromBacklog(parseInt(path.clubId), parseInt(path.movieId))
        default:
            return methodNotAllowed()
    }
}

// TODO: Don't really want this to exist, update Fauna function
export interface ReviewResponseResponse {
    reviews: ReviewResponse[];
}

async function reviewsHandler(event: HandlerEvent, context: HandlerContext, path: StringRecord): Promise<HandlerResponse> {
    let detailed = false
    if (event.queryStringParameters != null) {
        if (event.queryStringParameters['detailed'] === 'true') {
            detailed = true
        }
    }

    switch(event.httpMethod) {
        case "GET":
            return await getReviews(parseInt(path.clubId), detailed)
        case "POST":
            if (!isAuthorized(context)) return unauthorized()
            return await postReview(parseInt(path.clubId), parseInt(path.movieId))
        default:
            return methodNotAllowed()
    }
}

async function getReviews(clubId: number, detailed: boolean): Promise<HandlerResponse> {
    const reviews = await faunaClient.query<ReviewResponseResponse>(
        q.Call(q.Function("GetClubReviews"), clubId)
    )

    if (detailed) {
        reviews.reviews = await getReviewData(reviews.reviews)
        const detailedReviews = await detDetailedMovieData(reviews.reviews as DetailedReviewResponse[])
        return ok(JSON.stringify(detailedReviews))
    } else {
        reviews.reviews = await getReviewData(reviews.reviews)
        return ok(JSON.stringify(reviews.reviews))
    }
}

async function postReview(clubId: number, movieId: number): Promise<HandlerResponse> {
    console.log(`movieId: ${movieId}`)
    const clubResponse = await faunaClient.query<QueryResponse<Club>>(
        q.Call(q.Function("AddMovieToReviews"), clubId, movieId)
    )

    clubResponse.data.reviews = await getReviewData(clubResponse.data.reviews)

    return ok(JSON.stringify(clubResponse.data.reviews[0]))
}

// TODO: Don't really want this to exist, update Fauna function
export interface BacklogResponse {
    backlog: WatchListItem[];
}

async function addMovieToBacklog(clubId: number, movieId: number) {
    await faunaClient.query(
        q.Call(q.Function("AddMovieToBacklog"), [clubId, movieId])
    )

    const backlog = await faunaClient.query<BacklogResponse>(
        q.Call(q.Function("GetBacklog"), clubId)
    )

    backlog.backlog = await getMovieData(backlog.backlog)

    return ok(JSON.stringify(backlog.backlog))
}

async function deleteMovieFromBacklog(clubId: number, movieId: number) {
    await faunaClient
        .query(q.Call(q.Function("DeleteBacklogItem"), [clubId, movieId]))
        .catch((error) => {console.error(error)});

    return ok();
}

function isAuthorized(context: HandlerContext): boolean {
    return context.clientContext != null && context.clientContext.user
}

export { handler }

async function getMovieData(watchList: WatchListItem[]) {
    const configuration = await axios.get(`https://api.themoviedb.org/3/configuration?api_key=${tmdbApiKey}`)

    const promises = []
    for (const movie of watchList) {
        const promise = axios
            .get(`https://api.themoviedb.org/3/movie/${movie.movieId}?api_key=${tmdbApiKey}`)
            .then(response => {
                movie.movieTitle = response.data.title
                movie.releaseDate = response.data.release_date
                movie.poster_url = configuration.data.images.base_url + "w500" + response.data.poster_path
            })
        promises.push(promise)
    }

    await Promise.all(promises)
    return watchList
}

async function getReviewData(reviews: ReviewResponse[]) {
    const promises = []
    for (const movie of reviews) {
        const promise = axios
            .get(`https://api.themoviedb.org/3/movie/${movie.movieId}?api_key=${tmdbApiKey}`)
            .then(response => {
                movie.movieTitle = response.data.title
            })
        promises.push(promise)
    }

    await Promise.all(promises)
    return reviews
}

async function detDetailedMovieData(reviews: DetailedReviewResponse[]) {
    const promises = []

    const configuration = await axios.get(`https://api.themoviedb.org/3/configuration?api_key=${tmdbApiKey}`)

    for (const movie of reviews) {
      const promise = axios
        .get(
          `https://api.themoviedb.org/3/movie/${movie.movieId}?api_key=${tmdbApiKey}`
        )
        .then((response) => {
              movie.movieData = response.data
              movie.movieData.poster_url = configuration.data.images.base_url + "w500" + response.data.poster_path
          })
      promises.push(promise)
    }

    await Promise.all(promises)
    return reviews
}
