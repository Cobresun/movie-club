/* eslint-disable @typescript-eslint/no-var-requires */
const faunadb = require('faunadb')
const axios = require('axios')

const faunaClient = new faunadb.Client({ secret: process.env.FAUNADB_SERVER_SECRET })
const q = faunadb.query

const tmdbApiKey = process.env.TMDB_API_KEY

exports.handler = async function(event, context) {
    try {
        const req = await faunaClient.query(
            q.Map(
                q.Paginate(
                    q.Match(
                        q.Index("all_reviews_sort_by_date_desc")
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

        let reviews = await getMovieTitles(req.data)
        return { statusCode: 200, body: JSON.stringify(reviews) }
    } catch (err) {
        console.error(err)
        return { statusCode: 500, body: JSON.stringify({ error: err.message}) }
    }
}


// TODO: Make these requests run in parallel
async function getMovieTitles(reviews) {
    for (const review of reviews) {
        await axios
            .get(`https://api.themoviedb.org/3/movie/${review.movieId}?api_key=${tmdbApiKey}`)
            .then(response => review.movieTitle = response.data.title)
    }
    return reviews
}
