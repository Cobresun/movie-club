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
    if (!body.watchListId) {
        return response(400, {
            message: 'No watchListId specified. Please specify a watchListId.'
        });
    }
    if (!body.movieTitle) {
        return response(400, {
            message: 'No movieTitle specified. Please specify a movieTitle.'
        });
    }

    try {
        let date = new Date()
        date = date.toISOString().slice(0, 10)

        const data = {
            "nextMovieId": parseInt(body.movieId),
            "movieTitle": body.movieTitle,
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

        return response(200, nextWatch);
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