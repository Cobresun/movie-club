import { BaseReview, Review } from "./reviews";
import { BaseWatchListItem, WatchListItem } from "./watchlist";

export interface Member {
  id: string;
  email: string;
  name: string;
  image?: string;
  role?: string;
}

export interface ClubPreview {
  clubId: string;
  clubName: string;
}

export interface BaseClub extends ClubPreview {
  members: Member[];
  nextMovieId?: number;
  watchList: BaseWatchListItem[];
  backlog: WatchListItem[];
  reviews: BaseReview[];
}

export interface Club
  extends Omit<BaseClub, "reviews" | "backlog" | "watchList"> {
  watchList: WatchListItem[];
  backlog: WatchListItem[];
  reviews: Review[];
}
