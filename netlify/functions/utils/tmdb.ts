import axios, { AxiosResponse } from "axios";

import { ExternalWorkData, WorkListItem } from "@/common/types/lists";
import {
  BaseMovie,
  DetailedMovie,
  TMDBConfig,
  TMDBMovieData,
} from "@/common/types/movie";

async function makeTMDBApiCall<T>(path: string) {
  const tmdbApiKey = process.env.TMDB_API_KEY;
  return axios.get<T>(
    `https://api.themoviedb.org/3${path}?api_key=${tmdbApiKey}`
  );
}

async function getTMDBConfig() {
  return makeTMDBApiCall<TMDBConfig>("/configuration");
}

export async function getTMDBMovieData(
  movieId: number
): Promise<AxiosResponse<TMDBMovieData>> {
  return makeTMDBApiCall<TMDBMovieData>(`/movie/${movieId}`);
}

export async function getDetailedMovie<T extends BaseMovie>(
  movies: T[]
): Promise<(T & DetailedMovie)[]> {
  const configuration = await getTMDBConfig();
  return await Promise.all(
    movies.map(async (movie) => {
      const response = await getTMDBMovieData(movie.movieId);
      return {
        ...movie,
        movieTitle: response.data.title,
        movieData: response.data,
        posterUrl: `${configuration.data.images.secure_base_url}w154${response.data.poster_path}`,
      };
    })
  );
}

export async function getDetailedWorks<T extends WorkListItem>(
  works: T[]
): Promise<(T & ExternalWorkData<TMDBMovieData>)[]> {
  return await Promise.all(
    works.map(async (work) => {
      if (!work.externalId) {
        return work;
      }
      const response = await getTMDBMovieData(parseInt(work.externalId));
      return {
        ...work,
        externalData: response.data,
      };
    })
  );
}
