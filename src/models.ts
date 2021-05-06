export interface Header {
  value: string;
  style?: string;
  sortable?: boolean;
  includeHeader?: boolean;
  centerHeader?: boolean;
}

export interface ReviewResponse {
  movieTitle: string;
  dateWatched: string;
  scores: Object;
}

export interface WatchListResponse {
  movieTitle: string;
  dateAdded: string;
  addedBy: string;
}
