/* eslint-disable @typescript-eslint/no-var-requires */
const faunadb = require('faunadb')

const faunaClient = new faunadb.Client({ secret: process.env.FAUNADB_SERVER_SECRET })
const q = faunadb.query

/**
 * 
 * GET /club/:clubId -> returns full club data (clubId, clubName, members)
 * GET /club/:clubId/clubName -> returns club name
 * GET /club/:clubId/members -> returns array of members in club including their profile data (name, image)
 * TODO: GET /club/:clubId/stats -> returns club's stats object
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
                            q.Index("club_by_clubId"),
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

            let members = []
            for (const userName of req.data[0].data.members) {
                const memberReq = await faunaClient.query(
                    q.Map(
                        q.Paginate(
                            q.Match(
                                q.Index("members_by_email"),
                                userName
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
