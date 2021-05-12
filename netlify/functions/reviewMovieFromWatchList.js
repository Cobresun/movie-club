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
        let date = new Date()
        date = date.toISOString().slice(0, 10)

        const deleteWatchListMovieQuery = await faunaClient.query(
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

        const postReviewQuery = await faunaClient.query(
            q.Create(
                q.Collection("reviews"),
                {
                    data: {
                        "movieId": parseInt(body.movieId),
                        "dateWatched": q.Date(`${date}`),
                        "scores": { }
                    }
                }
            )
        )

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(postReviewQuery.data)
        }
    } catch (err) {
        console.error(err)
        return { statusCode: 500, body: JSON.stringify({ error: err.message}) }
    }
}
