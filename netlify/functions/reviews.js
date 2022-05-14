/* eslint-disable @typescript-eslint/no-var-requires */
const faunadb = require('faunadb')
const axios = require('axios')
const tmdbApiKey = process.env.TMDB_API_KEY

const faunaClient = new faunadb.Client({ secret: process.env.FAUNADB_SERVER_SECRET })
const q = faunadb.query

/**
 * 
 * GET /reviews/ -> returns every review from the DB
 * GET /reviews?detailed=true -> returns every review from the DB with the TMDB movie data alongside
 * 
 */

exports.handler = async function(event, context) {
    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            body: 'You are not using a http GET method for this endpoint.',
            headers: {
                'Allow': 'GET'
            }
        }
    }

    try {
        const req = await faunaClient.query(
            q.Map(
                q.Paginate(
                    q.Match(
                        q.Index("all_reviews_sort_by_time")
                    ),
                    { size: 100000 }
                ),
                q.Lambda(
                    ["d", "ref"], 
                    q.Select(
                        ["data"], 
                        q.Get(
                            q.Var("ref")
                        )
                    )
                )
            )
        )

        let ret = req.data

        if (event.queryStringParameters.detailed == 'true') {
            ret = await getMovieData(ret)
        }

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(ret)
        }
    } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ error: err.message}) }
    }
}

async function getMovieData(reviewList) {
    const promises = []

    let configuration = await axios.get(`https://api.themoviedb.org/3/configuration?api_key=${tmdbApiKey}`)

    for (const movie of reviewList) {
      const promise = axios
        .get(
          `https://api.themoviedb.org/3/movie/${movie.movieId}?api_key=${tmdbApiKey}`
        )
        .then((response) => {
              movie.movieData = response.data
              movie.movieData.poster_url = configuration.data.images.base_url + "w500" + response.data.poster_path
          })
      promises.push(promise)
    }

    await Promise.all(promises)
    return reviewList
}
