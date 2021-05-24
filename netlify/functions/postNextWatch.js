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
    console.log("Hello sunjeep");
    let body = event.queryStringParameters
    if (body.name === "" || !body.movieId) {
        return {
            statusCode: 402,
            body: 'No movieId specified. Please specify a movieId.'
        }
    } else if (!body.watchListId) {
        return {
            statusCode: 402,
            body: 'No watchListId specified. Please specify a watchListId.'
        }
    }

    try {
        let date = new Date()
        date = date.toISOString().slice(0, 10)

        const data = {
            "nextMovieId": parseInt(body.movieId),
            "watchListId": parseInt(body.watchListId),
            "datePicked": q.Date(`${date}`)
        };

        const req = await faunaClient.query(
            q.Let(
                {
                    match: q.Match(q.Index('nextMovie_by_watchListId'), parseInt(body.watchListId)),
                    data: { data: data }
                },
                q.If(
                    q.Exists(q.Var('match')),
                    q.Update(q.Select('ref', q.Get(q.Var('match'))), q.Var('data')),
                    q.Create(q.Collection('nextMovieWatchList'), q.Var('data'))
                )
            )
        )

        let nextWatch = req.data
        nextWatch.movieTitle = await getMovieTitleForId(data.nextMovieId)

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(nextWatch)
        }
    } catch (err) {
        console.error(err)
        return { statusCode: 500, body: JSON.stringify({ error: err.message}) }
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