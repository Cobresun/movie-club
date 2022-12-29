import { WatchListItem } from "@/common/types/models";

export function filterWatchList(reviews: WatchListItem[], searchTerm: string): WatchListItem[] {
    return reviews.filter(review =>
      review.movieTitle.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }
