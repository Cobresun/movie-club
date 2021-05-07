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
  movieTitle: string;
  dateWatched: DateObject;
  scores: Object;
}

export interface WatchListResponse {
  movieTitle: string;
  dateAdded: DateObject;
  addedBy: string;
}
