import { CacheDataService, WatchListViewModel } from "@/models";
import { useRequestCache } from "./useRequest";

export function useWatchList(
  clubId: string
): CacheDataService<WatchListViewModel> {
  const fetch = useRequestCache<WatchListViewModel>(
    `watchlist-${clubId}`,
    `/api/club/${clubId}/watchList`
  );
  return { ...fetch };
}
