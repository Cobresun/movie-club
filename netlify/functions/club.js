/* eslint-disable @typescript-eslint/no-var-requires */
const faunadb = require('faunadb')

const faunaClient = new faunadb.Client({ secret: process.env.FAUNADB_SERVER_SECRET })
const q = faunadb.query

/**
 * 
 * GET /club/:clubId -> returns full club data (clubId, clubName, members)
 * GET /club/:clubId/clubName -> returns club name
 * GET /club/:clubId/members -> returns array of members in club
 * 
 */

exports.handler = async function(event, context) {
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
            const req = await faunaClient.query(
                q.Map(
                    q.Paginate(
                        q.Match(
                            q.Index("all_members_in_club_by_clubId"),
                            clubId
                        )
                    ),
                    q.Lambda(
                        "X",
                        q.Get(
                            q.Var("X")
                        )
                    )
                )
            )

            let responseBody;
            if (method === 'members') {
                responseBody = req.data[0].data.members
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
            return { statusCode: 404, body: JSON.stringify({ error: err.message}) }
        }
    } else {
        return {
            statusCode: 405,
            body: 'You are not using a http GET method for this endpoint.',
            headers: {
                'Allow': 'GET'
            }
        }
    }
}
