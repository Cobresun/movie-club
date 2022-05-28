import { HandlerContext, HandlerEvent} from "@netlify/functions"
import faunadb from "faunadb"
import { getErrorMessage } from "./utils/validation"
import { Club, Member } from "../../src/models"
import axios from "axios"

const faunaClient = new faunadb.Client({ secret: process.env.FAUNADB_SERVER_SECRET ?? "" })
const q = faunadb.query

const tmdbApiKey = process.env.TMDB_API_KEY

/**
 * 
 * GET /club/:clubId -> returns full club data (clubId, clubName, members, nextMovieId, watchList)
 * 
 * PUT /club/:clubId/?nextMovieId={movieId}
 * 
 * POST /club/:clubId/?newWatchListItem={movieId}
 * 
 */

const handler = async function(event: HandlerEvent, context: HandlerContext) {
    const pathArray = event.path.split("/")
    const clubIdIndex = pathArray.indexOf('club') + 1
    const clubId = parseInt(pathArray[clubIdIndex])

    if (isNaN(clubId)) {
        return {
            statusCode: 422,
            body: 'Invalid clubId.'
        }
    }
    if (event.httpMethod === "POST") {
        if (context.clientContext != null && !context.clientContext.user) {
            return {
                statusCode: 401,
                body: 'You are not authorized to perform this action'
            }
        }

        if (event.queryStringParameters != null && event.queryStringParameters.newWatchListItem != null) {
            const newWatchListItem = parseInt(event.queryStringParameters.newWatchListItem)

            await faunaClient.query<void>(
                q.Let(
                    {
                      ref: q.Select("ref", q.Get(q.Match(q.Index("club_by_clubId"), clubId))),
                      doc: q.Get(q.Var('ref')),
                      array: q.Select(['data','watchList'], q.Var('doc'))
                    },
                    q.Update(
                        q.Var('ref'), 
                        { data: { watchList: q.Append([{ movieId: newWatchListItem, timeAdded: q.Now() }], q.Var('array')) } }
                    )
                )
            )

            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                },
                data: {}
            }
        }
    }
    else if (event.httpMethod === 'PUT') {
        if (context.clientContext != null && !context.clientContext.user) {
            return {
                statusCode: 401,
                body: 'You are not authorized to perform this action'
            }
        }

        if (event.queryStringParameters != null && event.queryStringParameters.nextMovieId != null) {
            await faunaClient.query<void>(
                q.Update(
                    q.Select("ref", q.Get(q.Match(q.Index("club_by_clubId"), clubId))),
                    {
                        data: {
                            nextMovieId: parseInt(event.queryStringParameters.nextMovieId)
                        }
                    }
                )
            )
            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                },
                data: {}
            }
        }
    }
    else if (event.httpMethod === 'GET') {
        try {
            const club = await faunaClient.query<Club>(
                q.Call(q.Function("GetClub"), clubId)
            )

            club.watchList = await getMovieData(club.watchList)

            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(club)
            }
        } catch (err) {
            return { statusCode: 404, body: JSON.stringify({ error: getErrorMessage(err) }) }
        }
    }
    else {
        return {
            statusCode: 405,
            body: 'You are not using a valid http method for this endpoint.'
        }
    }
}

export { handler }

async function getMovieData(watchList: any[]) {
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
