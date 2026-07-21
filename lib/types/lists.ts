import { z } from "zod";

import { DetailedBookData } from "./book";
import { WorkType } from "./generated/db";
import { DetailedMovieData, MovieDataSummary } from "./movie";

/**
 * Discriminated union of all media metadata shapes. Discriminate on `.kind`
 * (or on the sibling `WorkListItem.type`). Add a member here when introducing
 * a new club type.
 */
export type DetailedWorkData = DetailedMovieData | DetailedBookData;

/**
 * The bulk-payload variant of {@link DetailedWorkData}: each member may omit
 * its heavyweight fields (currently just the movie cast list). List and
 * reviews endpoints return this; the per-work details endpoint returns the
 * full shape. Book metadata is small enough to double as its own summary.
 */
export type WorkDataSummary = MovieDataSummary | DetailedBookData;

export interface WorkListItem {
  id: string;
  type: WorkType;
  title: string;
  createdDate: string;
  externalId?: string;
  imageUrl?: string;
  addedBy?: string;
}

export interface ReviewListItem extends WorkListItem {
  scores: ReviewScores;
}

/**
 * Per-user scores for a single work, keyed by user id. Includes a synthetic
 * `"average"` entry. Returned as-is by the lightweight per-work scores endpoint
 * (`GET /api/club/:clubSlug/reviews/:workId/scores`).
 */
export type ReviewScores = Record<string, Review>;

export interface Review {
  id: string;
  created_date: string;
  score: number;
}

export interface ExternalWorkData<T> {
  externalData?: T;
}

export type DetailedWorkListItem<T extends WorkDataSummary = WorkDataSummary> = WorkListItem &
  ExternalWorkData<T>;

export type DetailedReviewListItem<T extends WorkDataSummary = WorkDataSummary> = ReviewListItem &
  ExternalWorkData<T>;

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
  // The shared-review page is a single work, so it keeps the full metadata
  // shape (including cast) rather than the bulk summary.
  work: DetailedReviewListItem<DetailedWorkData>;
  clubName: string;
}
