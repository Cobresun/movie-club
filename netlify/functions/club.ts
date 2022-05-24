import { HandlerContext, HandlerEvent} from "@netlify/functions"
import faunadb from "faunadb"
import { getErrorMessage } from "./utils/validation"
import { Club, Member } from "../../src/models"

const faunaClient = new faunadb.Client({ secret: process.env.FAUNADB_SERVER_SECRET ?? "" })
const q = faunadb.query

/**
 * 
 * GET /club/:clubId -> returns full club data (clubId, clubName, members)
 * 
 * PUT /club/:clubId/?nextMovieId={movieId}
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

    if (event.httpMethod === 'PUT') {
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
    } else if (event.httpMethod === 'GET') {
        try {
            const club = await faunaClient.query<Club>(
                q.Select("data", q.Get(q.Match(q.Index("club_by_clubId"), clubId)))
            )

            club.members = await faunaClient.query<Member[]>(
                q.Map(
                    q.Select(["data", "members"], q.Get(q.Match(q.Index("club_by_clubId"), clubId))),
                    q.Lambda(
                        "memberRef",
                        q.Select("data", q.Get(q.Var("memberRef")))
                    )
                )
            )

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
    } else {
        return {
            statusCode: 405,
            body: 'You are not using a valid http method for this endpoint.'
        }
    }
}

export { handler };
