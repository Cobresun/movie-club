import axios, { AxiosResponse } from "axios";

import { hasValue } from "../../../lib/checks/checks.js";
import { ExternalWorkData, WorkListItem } from "../../../lib/types/lists";
import {
  BaseMovie,
  DetailedMovie,
  DetailedMovieData,
  TMDBConfig,
  TMDBMovieData,
} from "../../../lib/types/movie";

async function makeTMDBApiCall<T>(path: string) {
  const tmdbApiKey = process.env.TMDB_API_KEY;
  return axios.get<T>(
    `https://api.themoviedb.org/3${path}?api_key=${tmdbApiKey}`,
  );
}

async function getTMDBConfig() {
  return makeTMDBApiCall<TMDBConfig>("/configuration");
}

export async function getTMDBMovieData(
  movieId: number,
): Promise<AxiosResponse<TMDBMovieData>> {
  return makeTMDBApiCall<TMDBMovieData>(`/movie/${movieId}`);
}

export async function getDetailedMovie<T extends BaseMovie>(
  movies: T[],
): Promise<(T & DetailedMovie)[]> {
  const configuration = await getTMDBConfig();
  return await Promise.all(
    movies.map(async (movie) => {
      const response = await getTMDBMovieData(movie.movieId);
      const tmdbData = response.data;

      // Transform TMDBMovieData into DetailedMovieData
      const movieData: DetailedMovieData = {
        adult: tmdbData.adult,
        backdrop_path: tmdbData.backdrop_path,
        budget: tmdbData.budget,
        genres: tmdbData.genres.map((g) => g.name),
        homepage: tmdbData.homepage,
        id: tmdbData.id,
        imdb_id: tmdbData.imdb_id,
        original_language: tmdbData.original_language,
        original_title: tmdbData.original_title,
        overview: tmdbData.overview,
        popularity: tmdbData.popularity,
        poster_path: tmdbData.poster_path,
        production_companies: tmdbData.production_companies.map((c) => c.name),
        production_countries: tmdbData.production_countries.map((c) => c.name),
        release_date: tmdbData.release_date,
        revenue: tmdbData.revenue,
        runtime: tmdbData.runtime,
        spoken_languages: tmdbData.spoken_languages.map((l) => l.name),
        status: tmdbData.status,
        tagline: tmdbData.tagline,
        title: tmdbData.title,
        video: tmdbData.video,
        vote_average: tmdbData.vote_average,
        vote_count: tmdbData.vote_count,
      };

      return {
        ...movie,
        movieTitle: tmdbData.title,
        movieData,
        posterUrl: `${configuration.data.images.secure_base_url}w154${tmdbData.poster_path}`,
      };
    }),
  );
}

export async function getDetailedWorks<T extends WorkListItem>(
  works: T[],
): Promise<(T & ExternalWorkData<TMDBMovieData>)[]> {
  const chunkArray = <T>(array: T[], chunkSize: number): T[][] => {
    const result = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      result.push(array.slice(i, i + chunkSize));
    }
    return result;
  };

  const chunks = chunkArray(works, 50);

  const processedChunks = await Promise.all(
    chunks.map(async (chunk) => {
      return await Promise.all(
        chunk.map(async (work) => {
          if (!hasValue(work.externalId)) {
            return work;
          }
          const response = await getTMDBMovieData(parseInt(work.externalId));
          return {
            ...work,
            externalData: response.data,
          };
        }),
      );
    }),
  );

  return processedChunks.flat();
}
