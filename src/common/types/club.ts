import { Review } from "./reviews";
import { WatchListItem } from "./watchlist";

export interface Member {
  devAccount: boolean;
  email: string;
  name: string;
  image: string;
  clubs: number[];
}

export interface BaseClub {
  clubId: number;
  clubName: string;
}

export interface Club extends BaseClub {
  members: Member[];
  nextMovieId?: number;
  watchList: WatchListItem[];
  backlog: WatchListItem[];
  reviews: Review[];
}
