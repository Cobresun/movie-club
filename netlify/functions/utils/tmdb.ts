import { DetailedReviewResponse, ReviewResponse, WatchListItem } from "@/common/types/models";
import axios from "axios";
import { ReviewDatabaseObject } from "./types";

const tmdbApiKey = process.env.TMDB_API_KEY

// TODO: don't export this, get rid of any external usages
export async function getTMDBConfig() {
    return axios
        .get(`https://api.themoviedb.org/3/configuration?api_key=${tmdbApiKey}`)
}

export async function getTMDBMovieData(movieId: number) {
    return axios
        .get(`https://api.themoviedb.org/3/movie/${movieId}?api_key=${tmdbApiKey}`)
}

export async function getReviewData(reviews: ReviewDatabaseObject[]) {
    const promises: Promise<ReviewResponse>[] = [];
    for (const movie of reviews) {
        const promise = axios
        .get(
            `https://api.themoviedb.org/3/movie/${movie.movieId}?api_key=${tmdbApiKey}`
        )
        .then((response) => ({
            ...movie,
            movieTitle: response.data.title,
        }));
        promises.push(promise);
    }

    return await Promise.all(promises);
}

export async function getDetailedReviewData(reviews: DetailedReviewResponse[]) {
    const promises = [];

    const configuration = await getTMDBConfig()

    for (const movie of reviews) {
        const promise = axios
        .get(
            `https://api.themoviedb.org/3/movie/${movie.movieId}?api_key=${tmdbApiKey}`
        )
        .then((response) => {
            movie.movieTitle = response.data.title;
            movie.movieData = response.data;
            movie.movieData.poster_url = `${configuration.data.images.secure_base_url}w154${response.data.poster_path}`;
        });
        promises.push(promise);
    }

    await Promise.all(promises);
    return reviews;
}

export async function getWatchlistItemMovieData(watchList: WatchListItem[]) {
    const configuration = await getTMDBConfig()

    const promises = [];
    for (const movie of watchList) {
        const promise = axios
        .get(
            `https://api.themoviedb.org/3/movie/${movie.movieId}?api_key=${tmdbApiKey}`
        )
        .then((response) => {
            movie.movieTitle = response.data.title;
            movie.releaseDate = response.data.release_date;
            movie.poster_url =
            configuration.data.images.base_url +
            "w500" +
            response.data.poster_path;
        });
        promises.push(promise);
    }

    await Promise.all(promises);
    return watchList;
}
