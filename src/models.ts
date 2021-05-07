export interface Header {
  value: string;
  style?: string;
  title?: string;
  sortable?: boolean;
  includeHeader?: boolean;
  centerHeader?: boolean;
}

type DateWatched = {
  "@date": string
};

export interface ReviewResponse {
  movieTitle: string;
  dateWatched: DateWatched;
  scores: Object;
}

export interface WatchListResponse {
  movieTitle: string;
  dateAdded: string;
  addedBy: string;
}
