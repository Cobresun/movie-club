/* eslint-disable @typescript-eslint/no-var-requires */
const faunadb = require('faunadb')
const axios = require('axios')

const faunaClient = new faunadb.Client({ secret: process.env.FAUNADB_SERVER_SECRET })
const q = faunadb.query

const tmdbApiKey = process.env.TMDB_API_KEY

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
            statusCode: 412,
            body: 'No movieId specified. Please specify a movieId.'
        }
    }

    if (!body.movieTitle) {
        return {
            statusCode: 412,
            body: 'No movie title specified. Please specify a title.'
        }
    }

    try {
        let date = new Date()
        date = date.toISOString().slice(0, 10)

        const req = await faunaClient.query(
            q.Create(
                q.Collection("reviews"),
                {
                    data: {
                        "movieId": parseInt(body.movieId),
                        "movieTitle": body.movieTitle,
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
            body: JSON.stringify(req.data)
        }
    } catch (err) {
        console.error(err)
        return { statusCode: 500, body: JSON.stringify({ error: err.message}) }
    }
}
