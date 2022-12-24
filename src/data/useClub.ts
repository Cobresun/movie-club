import { ClubsViewClub, CacheDataService, Member } from "@/common/types/models";
import { useRequestCache } from "./useRequest";

export function useClub(clubId: string): CacheDataService<ClubsViewClub> {
  const fetch = useRequestCache<ClubsViewClub>(
    `club-${clubId}`,
    `/api/club/${clubId}`
  );
  return { ...fetch };
}

export function useMembers(clubId: string): CacheDataService<Member[]> {
  const fetch = useRequestCache<Member[]>(
    `members-${clubId}`,
    `/api/club/${clubId}/members`
  );
  return { ...fetch };
}
