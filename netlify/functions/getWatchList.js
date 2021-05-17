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
                        q.Index("all_watchList_sort_by_date")
                    )
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
        
        let watchList = await getMovieTitles(reqWatchList.data)

        // TODO: when expanding past mvp to multiple watchlists, fetch watchlistid for both queries
        // from event.queryStringParameters like reviewMovieFromWatchList.js instead of using "0"
        const reqNextMovie = await faunaClient.query(
            q.Map(
                q.Paginate(
                    q.Match(
                        q.Index("nextMovie_by_watchListId"),
                        parseInt("0")
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

        let nextMovie = reqNextMovie.data[0].data
        nextMovie.movieTitle = await getMovieTitleForId(nextMovie.nextMovieId)

        let nextMovieAndWatchList = {nextMovie, watchList}

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(nextMovieAndWatchList)
        }
    } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ error: err.message}) }
    }
}

async function getMovieTitles(watchList) {
  const promises = [];
  for (const review of watchList) {
    const promise = axios
      .get(
        `https://api.themoviedb.org/3/movie/${review.movieId}?api_key=${tmdbApiKey}`
      )
      .then((response) => (review.movieTitle = response.data.title));
    promises.push(promise);
  }
  await Promise.all(promises);
  return watchList;
}

async function getMovieTitleForId(movieId) {
  let title = "null";
  const promise = axios
    .get(
      `https://api.themoviedb.org/3/movie/${movieId}?api_key=${tmdbApiKey}`
    )
    .then((response) => (title = response.data.title));
  await promise;
  return title;
}