/* eslint-disable @typescript-eslint/no-var-requires */
const faunadb = require('faunadb')

const faunaClient = new faunadb.Client({ secret: process.env.FAUNADB_SERVER_SECRET })
const q = faunadb.query

exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 400,
            body: 'You are not using a http POST method for this endpoint.',
            headers: {
                'Allow': 'POST'
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
        let d = new Date()
        d = d.toISOString().slice(0, 10)
        console.log(d)

        const req = await faunaClient.query(
            q.Create(
                q.Collection("reviews"),
                {
                    data: {
                        "movieId": body.movieId,
                        "dateWatched": q.Date(`${d}`),
                        "scores": {
                            "cole": "null",
                            "brian": "null",
                            "wes": "null",
                            "sunny": "null",
                            "average": "null"
                        }
                    }
                }
            )
        )

        return { statusCode: 200, body: "Success" }
    } catch (err) {
        console.error(err)
        return { statusCode: 500, body: JSON.stringify({ error: err.message}) }
    }
}
