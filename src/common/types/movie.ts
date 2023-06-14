export interface BaseMovie {
  movieId: number;
}

export interface DetailedMovie extends BaseMovie {
  movieTitle: string;
  movieData: TMDBMovieData;
}

export interface TMDBGenre {
  id: number;
  name: string;
}

export interface TMDBMovieData {
  adult: boolean;
  backdrop_path: string;
  budget: number;
  genres: TMDBGenre[];
  homepage: string;
  id: number;
  imdb_id: string;
  original_language: string;
  original_title: string;
  overview: string;
  popularity: number;
  poster_path: string;
  production_companies: ProductionCompany[];
  release_date: string;
  revenue: number;
  runtime: number;
  tagline: string;
  title: string;
  poster_url: string;
}

export interface MovieSearchIndex {
  title: string;
  release_date: string;
  id: number;
}

export interface ProductionCompany {
  name: string;
}

export interface TMDBPageResponse {
  results: TMDBMovieData[];
  page: number;
  total_pages: number;
  total_results: number;
}
