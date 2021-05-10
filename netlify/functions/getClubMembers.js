/* eslint-disable @typescript-eslint/no-var-requires */
const faunadb = require('faunadb')

const faunaClient = new faunadb.Client({ secret: process.env.FAUNADB_SERVER_SECRET })
const q = faunadb.query

exports.handler = async function(event, context) {
    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 400,
            body: 'You are not using a http GET method for this endpoint.',
            headers: {
                'Allow': 'GET'
            }
        }
    }

    let body = event.queryStringParameters
    if (body.name === "" || !body.clubName) {
        return {
            statusCode: 402,
            body: 'No clubName specified. Please specify a clubName.'
        }
    }

    try {
        const req = await faunaClient.query(
            q.Map(
                q.Paginate(
                    q.Match(
                        q.Index("all_members_in_club_by_club_name"),
                        body.clubName
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

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(req.data[0].data.members)
        }
    } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ error: err.message}) }
    }
}
