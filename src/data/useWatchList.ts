import { DataService, WatchListViewModel } from "@/models";
import { useFetchCache } from "./useFetch";

export function useWatchList(clubId: string): DataService<WatchListViewModel> {
  const fetch = useFetchCache<WatchListViewModel>(
    `watchlist-${clubId}`, 
    `/api/club/${clubId}/watchList`
  );
  return {...fetch};
}