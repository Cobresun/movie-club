export interface Header {
  value: string;
  style?: string;
  title?: string;
  sortable?: boolean;
  includeHeader?: boolean;
  centerHeader?: boolean;
}

type DateObject = {
  "@date": string
};

export interface ReviewResponse {
  movieId: number;
  movieTitle: string;
  dateWatched: DateObject;
  scores: Object;
}

export interface WatchListResponse {
  movieTitle: string;
  dateAdded: DateObject;
  addedBy: string;
  movieId: number;
}

export interface NextMovieResponse {
  movieTitle: string;
  datePicked: DateObject;
}

export interface Member {
  name: string;
  image: string;
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
  release_date: string;
  revenue: number;
  runtime: number;
  tagline: string;
  title: string;
  poster_url: string;
}
