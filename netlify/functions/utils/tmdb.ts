import axios from "axios";

import { ReviewDatabaseObject } from "./types";

import {
  BaseMovie,
  DetailedMovie,
  DetailedReviewResponse,
  ReviewResponse,
  WatchListItem,
} from "@/common/types/models";

async function makeTMDBApiCall(path: string): Promise<any> {
  const tmdbApiKey = process.env.TMDB_API_KEY;
  return axios.get(`https://api.themoviedb.org/3${path}?api_key=${tmdbApiKey}`);
}

async function getTMDBConfig() {
  return makeTMDBApiCall("/configuration");
}

export async function getTMDBMovieData(movieId: number) {
  return makeTMDBApiCall(`/movie/${movieId}`);
}

export async function getMovieData(movieId: number) {
  const configuration = await getTMDBConfig();
  const movieData = await getTMDBMovieData(movieId);

  movieData.data.poster_url =
    configuration.data.images.base_url + "w500" + movieData.data.poster_path;

  return movieData.data;
}

export async function getReviewData(
  reviews: ReviewDatabaseObject[]
): Promise<ReviewResponse[]> {
  return Promise.all(
    reviews.map(async (review) => {
      const response = await makeTMDBApiCall(`/movie/${review.movieId}`);
      return {
        ...review,
        movieTitle: response.data.title,
      };
    })
  );
}

export async function getDetailedReviewData(
  reviews: DetailedReviewResponse[]
): Promise<DetailedReviewResponse[]> {
  const configuration = await getTMDBConfig();

  await Promise.all(
    reviews.map(async (review) => {
      const response = await makeTMDBApiCall(`/movie/${review.movieId}`);
      review.movieTitle = response.data.title;
      review.movieData = response.data;
      review.movieData.poster_url = `${configuration.data.images.secure_base_url}w154${response.data.poster_path}`;
    })
  );
  return reviews;
}

export async function getDetailedMovie<T extends BaseMovie>(
  movies: T[]
): Promise<(T & DetailedMovie)[]> {
  const configuration = await getTMDBConfig();
  return await Promise.all(
    movies.map(async (movie) => {
      const response = await makeTMDBApiCall(`/movie/${movie.movieId}`);
      const movieData = {
        ...response.data,
        poster_url: `${configuration.data.images.secure_base_url}w154${response.data.poster_path}`,
      };
      return {
        ...movie,
        movieTitle: response.data.title,
        movieData,
      };
    })
  );
}

export async function getWatchlistItemMovieData(
  watchList: WatchListItem[]
): Promise<WatchListItem[]> {
  const configuration = await getTMDBConfig();

  await Promise.all(
    watchList.map(async (movie) => {
      const response = await makeTMDBApiCall(`/movie/${movie.movieId}`);
      movie.movieTitle = response.data.title;
      movie.releaseDate = response.data.release_date;
      movie.poster_url =
        configuration.data.images.base_url + "w500" + response.data.poster_path;
    })
  );
  return watchList;
}
