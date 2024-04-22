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

export interface DetailedWorkListItem<T = TMDBMovieData> extends WorkListItem {
  externalData?: T;
}

export interface ListInsertDto {
  type: WorkType;
  title: string;
  externalId?: string;
  imageUrl?: string;
}
