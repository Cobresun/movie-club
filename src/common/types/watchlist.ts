import { DateObject } from "./common";
import { BaseMovie, DetailedMovie } from "./movie";

export interface BaseWatchListItem extends BaseMovie {
  timeAdded: DateObject;
}

export type WatchListItem = BaseWatchListItem & DetailedMovie;

export interface WatchListViewModel {
  watchList: WatchListItem[];
  backlog: WatchListItem[];
  nextMovieId?: number;
}
