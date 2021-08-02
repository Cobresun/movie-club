/* eslint-disable @typescript-eslint/no-var-requires */
const faunadb = require('faunadb')
const axios = require('axios')

const faunaClient = new faunadb.Client({ secret: process.env.FAUNADB_SERVER_SECRET })
const q = faunadb.query

const tmdbApiKey = process.env.TMDB_API_KEY

exports.handler = async function(event, context) {
    if (!context.clientContext.user) {
        return response(401, {
            message: 'You are not authorized to perform this action'
        });
    }

    if (event.httpMethod !== 'POST') {
        return response(400, { 
            message: 'You are not using http POST Method for this endpoint'
        });
    }

    let body = event.queryStringParameters
    if (body.name === "" || !body.movieId) {
        return response(400, {
            message: 'No movieId specified. Please specify a movieId.'
        });
    } 

    try {
        let date = new Date()
        date = date.toISOString().slice(0, 10)

        await faunaClient.query(
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
                        "movieTitle": await getMovieTitleForId(body.movieId),
                        "dateWatched": q.Date(`${date}`),
                        "scores": { }
                    }
                }
            )
        )

        return response(200, postReviewQuery.data);
    } catch (err) {
        console.error(err)
        return response(500, { error: err.message });
    }
}

async function getMovieTitleForId(movieId) {
    let title = "null";
    const promise = axios
        .get(`https://api.themoviedb.org/3/movie/${movieId}?api_key=${tmdbApiKey}`)
        .then((response) => (title = response.data.title));
    await promise;
    return title;
}

function response(code, body) {
    return {
        statusCode: code,
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    };
}
