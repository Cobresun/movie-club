import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import axios from "axios";
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";

import { useUserClubs } from "./useUser";
import { hasValue } from "../../lib/checks/checks.js";
import { ClubPreview, Member } from "../../lib/types/club";
import { WorkListType } from "../../lib/types/generated/db";

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
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      clubName,
      members,
    }: {
      clubName: string;
      members: string[];
    }) => auth.request.post(`/api/club`, { name: clubName, members }),
    onSuccess: () => {
      queryClient.invalidateQueries(["clubs"]).catch(console.error);
    },
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
    return clubs.value?.some((club) => club.clubId === clubId) ?? false;
  });
  return isUserInClub;
}

export function useAddMembers(clubId: string) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (members: string[]) =>
      auth.request.post(`/api/club/${clubId}/members`, { members }),
    onSuccess: () => queryClient.invalidateQueries(["members", clubId]),
  });
}

export function useLeaveClub(clubId: string) {
  const auth = useAuthStore();
  const router = useRouter();

  return useMutation({
    mutationFn: () => auth.request.delete(`/api/club/${clubId}/members/self`),
    onSuccess: () => router.push({ name: "Clubs" }),
  });
}

export function useJoinClub(inviteToken: string) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: () =>
      auth.request.post(`/api/club/members/join`, {
        token: inviteToken,
        userId: auth.user?.id,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries(["user", "clubs"]).catch(console.error);
      router.push({ name: "Clubs" }).catch(console.error);
    },
  });
}

export function useClubDetails(inviteToken: string) {
  return useQuery<ClubPreview>({
    queryKey: ["club-details", inviteToken],
    queryFn: async () => {
      try {
        const response = await axios.get<ClubPreview>(
          `/api/club/members/${inviteToken}`,
        );
        return response.data;
      } catch (error) {
        console.error("Error fetching club details:", error);
        throw error;
      }
    },
  });
}

export function useRemoveMember(clubId: string) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (memberId: string) =>
      auth.request.delete(`/api/club/${clubId}/members/${memberId}`),
    onSuccess: () => {
      queryClient.invalidateQueries(["members", clubId]).catch(console.error);
      queryClient
        .invalidateQueries({
          queryKey: ["list", clubId, WorkListType.reviews],
        })
        .catch(console.error); // TODO: this isn't working and refreshing scores
    },
  });
}

export function useInviteToken(clubId: string) {
  return useQuery({
    queryKey: ["invite-token", clubId],
    queryFn: async () => {
      const response = await axios.post<{ token: string }>(
        `/api/club/${clubId}/invite`,
      );
      return response.data.token;
    },
  });
}
