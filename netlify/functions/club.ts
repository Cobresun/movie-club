import { Handler } from "@netlify/functions"
import faunadb from "faunadb"
import { getErrorMessage } from "./utils/validation"
import { Club, Member } from "../../src/models"

const faunaClient = new faunadb.Client({ secret: process.env.FAUNADB_SERVER_SECRET ?? "" })
const q = faunadb.query

/**
 * 
 * GET /club/:clubId -> returns full club data (clubId, clubName, members)
 * 
 */

const handler: Handler = async function(event) {
    if (event.httpMethod === 'GET') {
        const pathArray = event.path.split("/")
        const clubIdIndex = pathArray.indexOf('club') + 1
        const clubId = parseInt(pathArray[clubIdIndex])

        if (isNaN(clubId)) {
            return {
                statusCode: 422,
                body: 'Invalid clubId.'
            }
        }
        
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
            body: 'You are not using a http GET method for this endpoint.',
        }
    }
}

export { handler };
