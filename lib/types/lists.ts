import { z } from "zod";

import { DetailedBookData } from "./book";
import { WorkType } from "./generated/db";
import { DetailedMovieData } from "./movie";

/**
 * Discriminated union of all media metadata shapes. Discriminate on `.kind`
 * (or on the sibling `WorkListItem.type`). Add a member here when introducing
 * a new club type.
 */
export type DetailedWorkData = DetailedMovieData | DetailedBookData;

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

export type DetailedWorkListItem<
  T extends DetailedWorkData = DetailedWorkData,
> = WorkListItem & ExternalWorkData<T>;

export type DetailedReviewListItem<
  T extends DetailedWorkData = DetailedWorkData,
> = ReviewListItem & ExternalWorkData<T>;

export interface WorkCommentDto {
  id: string;
  workId: string;
  userId: string;
  userName: string;
  userImage?: string;
  content: string;
  createdDate: string;
  spoiler: boolean;
}

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
  comments: WorkCommentDto[];
  work: DetailedReviewListItem;
  clubName: string;
}
