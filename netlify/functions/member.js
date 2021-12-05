/* eslint-disable @typescript-eslint/no-var-requires */
const faunadb = require('faunadb')

const faunaClient = new faunadb.Client({ secret: process.env.FAUNADB_SERVER_SECRET })
const q = faunadb.query

/**
 * 
 * GET /member/:email -> returns data for the member by email
 * 
 */
 
exports.handler = async function(event, context) {
    if (event.httpMethod === 'GET') {
        const pathArray = event.path.split("/")
        const emailIndex = pathArray.indexOf('member') + 1
        const email = pathArray[emailIndex]

        try {
            const req = await faunaClient.query(
                q.Map(
                    q.Paginate(
                        q.Match(
                            q.Index("members_by_email"),
                            email
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
            let responseBody = req.data[0].data

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