import { AxiosError, AxiosRequestConfig, AxiosResponse } from "axios";
import { ComputedRef, Ref } from "vue";

export interface Header {
  value: string;
  style?: string;
  title?: string;
  sortable?: boolean;
  includeHeader?: boolean;
  centerHeader?: boolean;
}

export type DateObject = {
  "@ts": string
};

export interface ReviewResponse {
  movieId: number;
  movieTitle: string;
  timeWatched: DateObject;
  scores: Record<string, number>;
}

export interface DetailedReviewResponse extends ReviewResponse {
  movieData: TMDBMovieData
}

export interface WatchListItem {
  timeAdded: DateObject;
  movieTitle: string;
  movieId: number;
  releaseDate: string;
  poster_url: string;
}

export interface Member {
  devAccount: boolean;
  email: string;
  name: string;
  image: string;
  clubs: number[];
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

export interface ProductionCompany {
  name: string;
}

export interface MovieSearchIndex {
  title: string;
  release_date: string;
  id: number;
}

export interface ClubsViewClub {
  clubId: number;
  clubName: string;
}

export interface WatchListViewModel {
  watchList: WatchListItem[];
  backlog: WatchListItem[];
  nextMovieId?: number;
}

export interface Club {
  clubId: number;
  clubName: string;
  members: Member[];
  nextMovieId?: number;
  watchList: WatchListItem[];
  backlog: WatchListItem[];
  reviews: ReviewResponse[];
}

export interface FetchConfig extends AxiosRequestConfig {
  skip?: boolean;
}

export interface DataService<T> {
  data: ComputedRef<T>,
  response: ComputedRef<AxiosResponse>,
  error: Ref<AxiosError | unknown>,
  loading: Ref<boolean>,
  fetch: () => void;
  clear: () => void;
  refresh: () => void;
}