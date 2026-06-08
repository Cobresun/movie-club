import { DateObject } from "./common.js";
import { BaseMovie, DetailedMovie } from "./movie.js";

export interface BaseReview extends BaseMovie {
  timeWatched: DateObject;
  scores: Record<string, number>;
}

export type Review = BaseReview & DetailedMovie;
