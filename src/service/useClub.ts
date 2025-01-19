import { useMutation, useQuery } from "@tanstack/vue-query";
import axios from "axios";
import { computed } from "vue";
import { useRoute } from "vue-router";

import { useUserClubs } from "./useUser";
import { hasValue, isDefined } from "../../lib/checks/checks.js";
import { ClubPreview, Member } from "../../lib/types/club";

import { useAuthStore } from "@/stores/auth";

const fetchClub = async (clubId: string | number) =>
  (await axios.get<ClubPreview>(`/api/club/${clubId}`)).data;

export function useClub(clubId: string) {
  return useQuery<ClubPreview>({
    queryKey: ["club", clubId],
    queryFn: async () => await fetchClub(clubId),
  });
}

export function useCreateClub() {
  const auth = useAuthStore();
  return useMutation({
    mutationFn: ({
      clubName,
      members,
    }: {
      clubName: string;
      members: string[];
    }) => auth.request.post(`/api/club`, { name: clubName, members }),
  });
}

export function useMembers(clubId: string) {
  return useQuery<Member[]>({
    queryKey: ["members", clubId],
    queryFn: async () =>
      (await axios.get<Member[]>(`/api/club/${clubId}/members`)).data,
  });
}

export function useClubId(): string {
  const route = useRoute();
  if (!Array.isArray(route.params.clubId) && hasValue(route.params.clubId)) {
    return route.params.clubId;
  }
  throw Error("This route does not include a clubId");
}

export function useIsInClub(clubId: string) {
  const { data: clubs } = useUserClubs();
  const isUserInClub = computed(() => {
    return isDefined(clubs.value?.some((club) => club.clubId === clubId));
  });
  return isUserInClub;
}
