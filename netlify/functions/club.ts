import { Handler } from "@netlify/functions";
import faunadb from "faunadb";
import { QueryResponse } from "./utils/types";
import { getErrorMessage } from "./utils/validation";

import { Member, Club } from "../../src/models";

const faunaClient = new faunadb.Client({ secret: process.env.FAUNADB_SERVER_SECRET ?? "" })
const q = faunadb.query

/**
 * 
 * GET /club/:clubId -> returns full club data (clubId, clubName, members)
 * GET /club/:clubId/clubName -> returns club name
 * GET /club/:clubId/members -> returns array of members in club including their profile data (name, image)
 * TODO: GET /club/:clubId/stats -> returns club's stats object
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

        const method = pathArray[clubIdIndex + 1]
        
        try {
            const req = await faunaClient.query<QueryResponse<Club>>(
                q.Map(
                    q.Paginate(q.Match(q.Index("club_by_clubId"), clubId)),
                    q.Lambda("X", q.Get(q.Var("X")))
                )
            )

            const members = []
            for (const userName of req.data[0].data.members) {
                const memberReq = await faunaClient.query<QueryResponse<Member>>(
                    q.Map(
                        q.Paginate(q.Match(q.Index("members_by_email"), userName)),
                        q.Lambda("X", q.Get(q.Var("X")))
                    )
                )
                members.push(memberReq.data[0].data)
            }
            
            let responseBody;
            if (method === 'members') {
                responseBody = members
            } else if (method === 'clubName') {
                responseBody = req.data[0].data.clubName
            } else if (method === undefined || method === '') {
                responseBody = req.data[0].data
            } else {
                return {
                    statusCode: 400,
                    body: `Invalid accessor "${method}" on club data.`
                }
            }

            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(responseBody)
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