/* eslint-disable @typescript-eslint/no-var-requires */
const faunadb = require('faunadb')

const faunaClient = new faunadb.Client({ secret: process.env.FAUNADB_SERVER_SECRET })
const q = faunadb.query

exports.handler = async function(event, context) {
    if (event.httpMethod !== 'DELETE') {
        return {
            statusCode: 400,
            body: 'You are not using a http DELETE method for this endpoint.',
            headers: {
                'Allow': 'DELETE'
            }
        }
    }

    let body = event.queryStringParameters
    if (body.name === "" || !body.movieId) {
        return {
            statusCode: 402,
            body: 'No movieId specified. Please specify a movieId.'
        }
    }

    try {
        const req = await faunaClient.query(
            q.Delete(
                q.Select(
                    "ref",
                    q.Get(
                        q.Match(
                            q.Index("watchList_by_movieId"),
                            parseInt(body.movieId)
                        )
                    )
                )
            )
        )

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(req.data)
        }
    } catch (err) {
        console.error(err)
        return { statusCode: 500, body: JSON.stringify({ error: err.message}) }
    }
}
