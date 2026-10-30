import axios from "axios";

import type { BrowsePage, WorkSearchResult } from "../types";
import { TMDBMovieData, TMDBPageResponse } from "@/../lib/types/movie";

const TMDB_KEY = import.meta.env.VITE_TMDB_API_KEY;
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w154";

function movieToResult(movie: TMDBMovieData): WorkSearchResult {
  return {
    externalId: String(movie.id),
    title: movie.title,
    subtitle: movie.release_date ? movie.release_date.slice(0, 4) : undefined,
    imageUrl: movie.poster_path ? `${TMDB_IMAGE_BASE}${movie.poster_path}` : undefined,
  };
}

export async function searchMovies(
  query: string,
  signal?: AbortSignal,
): Promise<WorkSearchResult[]> {
  const { data } = await axios.get<TMDBPageResponse>(
    `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(query)}&language=en-US&include_adult=false`,
    { signal },
  );
  return data.results.map(movieToResult);
}

/** A page of one of TMDB's movie collections (popular, now playing, …). */
export async function browseMovies(
  collection: string,
  page: number,
  signal?: AbortSignal,
): Promise<BrowsePage> {
  const { data } = await axios.get<TMDBPageResponse>(
    `https://api.themoviedb.org/3/movie/${collection}?api_key=${TMDB_KEY}&language=en-US&page=${page}`,
    { signal },
  );
  return {
    results: data.results.map(movieToResult),
    nextPage: data.page < data.total_pages ? data.page + 1 : undefined,
  };
}
