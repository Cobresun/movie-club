import axios from "axios";

import { QueryResponse } from "./types";

import { BaseMovie, DetailedMovie, TMDBMovieData } from "@/common/types/movie";

async function makeTMDBApiCall(path: string) {
  const tmdbApiKey = process.env.TMDB_API_KEY;
  return axios.get(`https://api.themoviedb.org/3${path}?api_key=${tmdbApiKey}`);
}

async function getTMDBConfig() {
  return makeTMDBApiCall("/configuration");
}

export async function getTMDBMovieData(
  movieId: number
): Promise<QueryResponse<TMDBMovieData>> {
  return makeTMDBApiCall(`/movie/${movieId}`);
}

export async function getDetailedMovie<T extends BaseMovie>(
  movies: T[]
): Promise<(T & DetailedMovie)[]> {
  const configuration = await getTMDBConfig();
  return await Promise.all(
    movies.map(async (movie) => {
      const response = await makeTMDBApiCall(`/movie/${movie.movieId}`);
      return {
        ...movie,
        movieTitle: response.data.title,
        movieData: response.data,
        posterUrl: `${configuration.data.images.secure_base_url}w154${response.data.poster_path}`,
      };
    })
  );
}
