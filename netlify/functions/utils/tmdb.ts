import axios from "axios";

const tmdbApiKey = process.env.TMDB_API_KEY

export async function getTMDBConfig() {
    return axios
        .get(`https://api.themoviedb.org/3/configuration?api_key=${tmdbApiKey}`)
}

export async function getTMDBMovieData(movieId: number) {
    return axios
        .get(`https://api.themoviedb.org/3/movie/${movieId}?api_key=${tmdbApiKey}`)
}
