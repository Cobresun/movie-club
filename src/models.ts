export interface Header {
  value: string;
  style?: string;
}

export interface ReviewResponse {
  movieTitle: string;
  dateWatched: string;
  scores: Object;
}
