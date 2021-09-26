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

        let configuration = await getConfiguration()

        let movieData = await getMovieData(movieId)

        movieData.data.poster_url = configuration.data.images.base_url + "w500" + movieData.data.poster_path

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(movieData.data)
        }
    }
}

async function getConfiguration() {
    return axios
        .get(`https://api.themoviedb.org/3/configuration?api_key=${tmdbApiKey}`)
}

async function getMovieData(movieId) {
    return axios
        .get(`https://api.themoviedb.org/3/movie/${movieId}?api_key=${tmdbApiKey}`)
}
