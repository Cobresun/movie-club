/* eslint-disable @typescript-eslint/no-var-requires */
const faunadb = require('faunadb')
const axios = require('axios')

const faunaClient = new faunadb.Client({ secret: process.env.FAUNADB_SERVER_SECRET })
const q = faunadb.query

const tmdbApiKey = process.env.TMDB_API_KEY

exports.handler = async function(event, context) {
    try {
        const reqWatchList = await faunaClient.query(
            q.Map(
                q.Paginate(
                    q.Match(
                        q.Index("all_watchList_sort_by_time")
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
        
        let watchList = await getMovieData(reqWatchList.data)

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(watchList)
        }
    } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ error: err.message}) }
    }
}

async function getConfiguration() {
    return axios
        .get(`https://api.themoviedb.org/3/configuration?api_key=${tmdbApiKey}`)
}

async function getMovieData(watchList) {
    let configuration = await getConfiguration()
    const promises = []
    for (const movie of watchList) {
    const promise = axios
        .get(
        `https://api.themoviedb.org/3/movie/${movie.movieId}?api_key=${tmdbApiKey}`
        )
        .then((response) => {
            movie.movieTitle = response.data.title
            movie.releaseDate = response.data.release_date
            movie.poster_url = configuration.data.images.base_url + "w500" + response.data.poster_path
        });
    promises.push(promise)
    }
    await Promise.all(promises)
    return watchList
}
