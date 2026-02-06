import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import type { UseQueryReturnType } from "@tanstack/vue-query";
import axios from "axios";
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";

import { useUserClubs } from "./useUser";
import { hasValue } from "../../lib/checks/checks.js";
import { ClubPreview, Member } from "../../lib/types/club";
import { WorkListType } from "../../lib/types/generated/db";

import { useAuthStore } from "@/stores/auth";

const fetchClub = async (clubIdentifier: string) =>
  (await axios.get<ClubPreview>(`/api/club/${clubIdentifier}`)).data;

export function useClub(clubIdentifier: string) {
  return useQuery<ClubPreview>({
    queryKey: ["club", clubIdentifier],
    queryFn: async () => await fetchClub(clubIdentifier),
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
      queryClient.invalidateQueries(["user", "clubs"]).catch(console.error);
    },
  });
}

export function useMembers(clubIdentifier: string) {
  return useQuery<Member[]>({
    queryKey: ["members", clubIdentifier],
    queryFn: async () =>
      (await axios.get<Member[]>(`/api/club/${clubIdentifier}/members`)).data,
  });
}

export function useClubSlug(): string {
  const route = useRoute();
  if (
    !Array.isArray(route.params.clubSlug) &&
    hasValue(route.params.clubSlug)
  ) {
    return route.params.clubSlug;
  }
  throw Error("This route does not include a clubSlug");
}

export function useIsInClub(clubSlug: string) {
  const { data: clubs, isLoading } = useUserClubs();
  const isUserInClub = computed(() => {
    return isLoading.value
      ? false
      : (clubs.value?.some((club) => club.slug === clubSlug) ?? false);
  });
  return isUserInClub;
}

export function useAddMembers(clubIdentifier: string) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (members: string[]) =>
      auth.request.post(`/api/club/${clubIdentifier}/members`, { members }),
    onSuccess: () => queryClient.invalidateQueries(["members", clubIdentifier]),
  });
}

export function useLeaveClub(clubIdentifier: string) {
  const auth = useAuthStore();
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      auth.request.delete(`/api/club/${clubIdentifier}/members/self`),
    onSuccess: () => {
      queryClient.invalidateQueries(["user", "clubs"]).catch(console.error);
      router.push({ name: "Clubs" }).catch(console.error);
    },
  });
}

export function useJoinClub(inviteToken: string) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: () =>
      auth.request.post(`/api/club/join`, {
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
          `/api/club/joinInfo/${inviteToken}`,
        );
        return response.data;
      } catch (error) {
        console.error("Error fetching club details:", error);
        throw error;
      }
    },
  });
}

export function useRemoveMember(clubIdentifier: string) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (memberId: string) =>
      auth.request.delete(`/api/club/${clubIdentifier}/members/${memberId}`),
    onSuccess: () => {
      queryClient
        .invalidateQueries(["members", clubIdentifier])
        .catch(console.error);
      queryClient
        .invalidateQueries({
          queryKey: ["list", clubIdentifier, WorkListType.reviews],
        })
        .catch(console.error); // TODO: this isn't working and refreshing scores
    },
  });
}

export function useInviteToken(clubIdentifier: string) {
  return useQuery({
    queryKey: ["invite-token", clubIdentifier],
    queryFn: async () => {
      const response = await axios.post<{ token: string }>(
        `/api/club/${clubIdentifier}/invite`,
      );
      return response.data.token;
    },
  });
}

interface ClubSettings {
  features: {
    blurScores: boolean;
    awards: boolean;
  };
}

interface ClubSettingsUpdate {
  features?: Partial<ClubSettings["features"]>;
}

export function useClubSettings(
  clubIdentifier: string,
): UseQueryReturnType<ClubSettings, unknown> {
  const auth = useAuthStore();
  return useQuery<ClubSettings>({
    queryKey: ["club", clubIdentifier, "settings"],
    queryFn: async () => {
      const response = await auth.request.get<ClubSettings>(
        `/api/club/${clubIdentifier}/settings`,
      );
      return response.data;
    },
  });
}

export function useUpdateClubSettings(clubIdentifier: string) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (newSettings: ClubSettingsUpdate) =>
      auth.request.post(`/api/club/${clubIdentifier}/settings`, newSettings),
    onMutate: async (newSettings: ClubSettingsUpdate) => {
      await queryClient.cancelQueries(["club", clubIdentifier, "settings"]);

      const previousSettings = queryClient.getQueryData<ClubSettings>([
        "club",
        clubIdentifier,
        "settings",
      ]);

      if (previousSettings) {
        queryClient.setQueryData<ClubSettings>(
          ["club", clubIdentifier, "settings"],
          {
            ...previousSettings,
            features: {
              ...previousSettings.features,
              ...newSettings.features,
            },
          },
        );
      }

      return { previousSettings };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousSettings) {
        queryClient.setQueryData(
          ["club", clubIdentifier, "settings"],
          context.previousSettings,
        );
      }
    },
    onSettled: () => {
      queryClient
        .invalidateQueries(["club", clubIdentifier, "settings"])
        .catch(console.error);
    },
  });
}

export function useUpdateClubSlug(clubIdentifier: string) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (newSlug: string) =>
      auth.request.put<{ slug: string }>(`/api/club/${clubIdentifier}/slug`, {
        slug: newSlug,
      }),
    onSuccess: (response) => {
      const newSlug = response.data.slug;
      // Invalidate club queries
      queryClient.invalidateQueries(["club"]).catch(console.error);
      queryClient.invalidateQueries(["user", "clubs"]).catch(console.error);

      // Navigate to the new slug URL
      const currentRoute = router.currentRoute.value;
      router
        .push({
          name: currentRoute.name ?? undefined,
          params: { ...currentRoute.params, clubSlug: newSlug },
        })
        .catch(console.error);
    },
  });
}

export function useUpdateClubName(clubId: string) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) =>
      auth.request.put(`/api/club/${clubId}/name`, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries(["club", clubId]).catch(console.error);
      queryClient.invalidateQueries(["user", "clubs"]).catch(console.error);
    },
  });
}
