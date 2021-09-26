// eslint-disable-next-line @typescript-eslint/no-var-requires
const axios = require('axios')
const tmdbApiKey = process.env.TMDB_API_KEY

/**
 * 
 * GET /movie/:movieId -> returns full movie data
 * 
 */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
exports.handler = async function(event, _context) {
    if (event.httpMethod === 'GET') {
        const pathArray = event.path.split("/")
        const movieIdIndex = pathArray.indexOf('movie') + 1
        const movieId = parseInt(pathArray[movieIdIndex])
        
        if (isNaN(movieId)) {
            return {
                statusCode: 422,
                body: 'Invalid movieId.'
            }
        }

        let movieData = await getMovieData(movieId)

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(movieData)
        }
    }
}

async function getMovieData(movieId) {
    return axios
        .get(`https://api.themoviedb.org/3/movie/${movieId}?api_key=${tmdbApiKey}`)
}
