import { WorkType } from "./generated/db";
import { TMDBMovieData } from "./movie";

export interface WorkListItem {
  id: string;
  type: WorkType;
  title: string;
  createdDate: string;
  externalId?: string;
  imageUrl?: string;
}

export interface ReviewListItem extends WorkListItem {
  scores: Record<string, Review>;
}

export interface Review {
  id: string;
  created_date: string;
  score: number;
}

export interface ExternalWorkData<T> {
  externalData?: T;
}

export type DetailedWorkListItem<T = TMDBMovieData> = WorkListItem &
  ExternalWorkData<T>;

export type DetailedReviewListItem<T = TMDBMovieData> = ReviewListItem &
  ExternalWorkData<T>;

export interface ListInsertDto {
  type: WorkType;
  title: string;
  externalId?: string;
  imageUrl?: string;
}
