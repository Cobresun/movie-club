import { z } from "zod";

import { WorkType } from "./generated/db";
import { DetailedMovieData } from "./movie";

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

export type DetailedWorkListItem<T = DetailedMovieData> = WorkListItem &
  ExternalWorkData<T>;

export type DetailedReviewListItem<T = DetailedMovieData> = ReviewListItem &
  ExternalWorkData<T>;

export const listInsertDtoSchema = z.object({
  type: z.nativeEnum(WorkType),
  title: z.string(),
  externalId: z.string().optional(),
  imageUrl: z.string().optional(),
});

export type ListInsertDto = z.infer<typeof listInsertDtoSchema>;

export interface SharedReviewResponse {
  members: {
    id: string;
    name: string;
    image: string;
  }[];
  reviews: {
    user_id: string;
    score: number;
    created_date: string;
  }[];
  work: DetailedReviewListItem;
  clubName: string;
}
