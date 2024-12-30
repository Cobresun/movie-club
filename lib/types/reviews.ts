import { DateObject } from "./common";
import { BaseMovie, DetailedMovie } from "./movie";

export interface BaseReview extends BaseMovie {
  timeWatched: DateObject;
  scores: Record<string, number>;
}

export type Review = BaseReview & DetailedMovie;
