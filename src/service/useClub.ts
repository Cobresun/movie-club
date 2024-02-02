import { useMutation, useQueries, useQuery } from "@tanstack/vue-query";
import axios from "axios";
import { Ref, computed } from "vue";
import { useRoute } from "vue-router";

import { BaseClub, Member } from "@/common/types/club";
import { useAuthStore } from "@/stores/auth";

const fetchClub = async (clubId: string | number) =>
  (await axios.get(`/api/club/${clubId}`)).data;

export function useClub(clubId: string) {
  return useQuery<BaseClub>({
    queryKey: ["club", clubId],
    queryFn: async () => await fetchClub(clubId),
  });
}

export function useClubs(clubIds: Ref<string[]>, enabled: Ref<boolean>) {
  const queries = computed(() =>
    clubIds.value.map((clubId) => ({
      queryKey: ["club", clubId],
      queryFn: async () => await fetchClub(clubId),
      enabled,
    }))
  );
  return useQueries<BaseClub[]>({
    queries,
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
    queryFn: async () => (await axios.get(`/api/club/${clubId}/members`)).data,
  });
}

export function useClubId(): string {
  const route = useRoute();
  if (route.params.clubId) return route.params.clubId as string;
  throw Error("This route does not include a clubId");
}
