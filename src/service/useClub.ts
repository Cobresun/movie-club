import { useRoute } from "vue-router";

import { useRequestCache, useAuthRequest } from "./useRequest";

import { ClubsViewClub, CacheDataService, Member } from "@/common/types/models";

export function useClub(clubId: string): CacheDataService<ClubsViewClub> {
  const fetch = useRequestCache<ClubsViewClub>(
    `club-${clubId}`,
    `/api/club/${clubId}`
  );
  return { ...fetch };
}

export function useCreateClub() {
  const request = useAuthRequest();

  const createClub = async (clubName: string, members: string[]) => {
    await request.execute(`/api/club`, {
      data: {
        name: clubName,
        members: members,
      },
      method: "PUT",
    });
  };
  return { ...request, createClub };
}

export function useMembers(clubId: string): CacheDataService<Member[]> {
  const fetch = useRequestCache<Member[]>(
    `members-${clubId}`,
    `/api/club/${clubId}/members`
  );
  return { ...fetch };
}

export function useClubId(): string {
  const route = useRoute();
  if (route.params.clubId) return route.params.clubId as string;
  throw Error("This route does not include a clubId");
}
