import { values } from "faunadb";

export type QueryListResponse<T> = {
    data: values.Document<T>[]
}

export type QueryResponse<T> = {
    data: T
}

export type PageResponse<T> = {
    page: number;
    pageSize: number;
    hasNextPage: boolean;
    data: T[];
}

export type StringRecord = Record<string, string>;

export interface ReviewResponseResponse {
    reviews: ReviewDatabaseObject[];
}
  
export interface ReviewDatabaseObject {
    movieId: number;
    timeWatched: DateObject;
    scores: Record<string, number>;
}
