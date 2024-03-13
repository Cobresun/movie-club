import { TMDBMovieData } from "./movie";

export interface WorkListItem {
  id: string;
  type: string;
  title: string;
  createdDate: string;
  externalId?: string;
  imageUrl?: string;
}

export interface DetailedWorkListItem<T = TMDBMovieData> extends WorkListItem {
  externalData?: T;
}

export interface ListInsertDto {
  type: string;
  title: string;
  externalId?: string;
  imageUrl?: string;
}
