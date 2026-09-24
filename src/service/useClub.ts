import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import type { UseQueryReturnType } from "@tanstack/vue-query";
import axios from "axios";
import { computed, unref } from "vue";
import type { MaybeRef } from "vue";
import { useRoute, useRouter } from "vue-router";

import { hasValue, isDefined } from "../../lib/checks/checks.js";
import { ClubPreview, Member } from "../../lib/types/club";
import { ClubType } from "../../lib/types/generated/db";
import { clearLastClubSlug, getLastClubSlug } from "../common/composables/useLastClubSlug";
import { reviewsListKey } from "./useList";
import { useUserClubs } from "./useUser";
import { useAuthStore } from "@/stores/auth";

const userClubsKey = ["user", "clubs"] as const;

const fetchClub = async (clubSlug: string) =>
  (await axios.get<ClubPreview>(`/api/club/${clubSlug}`)).data;

export function useClub(clubSlug: string) {
  return useQuery<ClubPreview>({
    queryKey: ["club", clubSlug],
    queryFn: async () => await fetchClub(clubSlug),
  });
}

export function useCreateClub() {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      clubName,
      members,
      type,
    }: {
      clubName: string;
      members: string[];
      type: ClubType;
    }) =>
      auth.request.post<{ clubId: string; slug: string }>(`/api/club`, {
        name: clubName,
        members,
        type,
      }),
    // The response names the new club, so the membership list can carry it
    // before the refetch lands and the club's route guard lets the owner
    // straight in.
    onSuccess: ({ data }, { clubName, type }) => {
      queryClient.setQueryData<ClubPreview[]>(userClubsKey, (current) => [
        ...(current ?? []),
        { clubId: data.clubId, clubName, slug: data.slug, slugUpdatedAt: undefined, type },
      ]);
      queryClient.invalidateQueries(userClubsKey).catch(console.error);
    },
  });
}

export function useMembers(clubSlug: MaybeRef<string>) {
  const slug = computed(() => unref(clubSlug));
  return useQuery<Member[]>({
    queryKey: computed(() => ["members", slug.value]),
    queryFn: async () => (await axios.get<Member[]>(`/api/club/${slug.value}/members`)).data,
    enabled: () => slug.value !== "",
  });
}

export function useClubSlug(): string {
  const route = useRoute();
  if (!Array.isArray(route.params.clubSlug) && hasValue(route.params.clubSlug)) {
    return route.params.clubSlug;
  }
  throw Error("This route does not include a clubSlug");
}

export function useIsInClub(clubSlug: MaybeRef<string>) {
  const { data: clubs, isLoading } = useUserClubs();
  const isUserInClub = computed(() => {
    const slug = unref(clubSlug);
    return isLoading.value ? false : (clubs.value?.some((club) => club.slug === slug) ?? false);
  });
  return isUserInClub;
}

export function useLeaveClub(clubSlug: string) {
  const auth = useAuthStore();
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => auth.request.delete(`/api/club/${clubSlug}/members/self`),
    onSuccess: () => {
      queryClient.setQueryData<ClubPreview[]>(userClubsKey, (current) =>
        current?.filter((club) => club.slug !== clubSlug),
      );
      // Clear lastClubSlug so the Clubs guard doesn't redirect back to the left club
      if (getLastClubSlug() === clubSlug) {
        clearLastClubSlug();
      }
      // Revalidate only once the Clubs guard has read the list above: started
      // first, the refetch is what that guard would sit waiting for.
      router
        .push({ name: "Clubs" })
        .then(() => queryClient.invalidateQueries(userClubsKey))
        .catch(console.error);
    },
  });
}

export function useJoinClub(inviteToken: string) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      auth.request.post(`/api/club/join`, {
        token: inviteToken,
        userId: auth.user?.id,
      }),
    // Navigation to the joined club is handled by JoinClubView, which reacts
    // to the membership list gaining the club. The invite page already holds
    // the club's preview, so the list carries it before the refetch lands.
    onSuccess: () => {
      const joined = queryClient.getQueryData<ClubPreview>(["club-details", inviteToken]);
      if (isDefined(joined)) {
        queryClient.setQueryData<ClubPreview[]>(userClubsKey, (current) =>
          current?.some((club) => club.clubId === joined.clubId) === true
            ? current
            : [...(current ?? []), joined],
        );
      }
      queryClient.invalidateQueries(userClubsKey).catch(console.error);
    },
  });
}

export function useClubDetails(inviteToken: string) {
  return useQuery<ClubPreview>({
    queryKey: ["club-details", inviteToken],
    queryFn: async () => {
      try {
        const response = await axios.get<ClubPreview>(`/api/club/joinInfo/${inviteToken}`);
        return response.data;
      } catch (error) {
        console.error("Error fetching club details:", error);
        throw error;
      }
    },
  });
}

export function useRemoveMember(clubSlug: string) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (memberId: string) =>
      auth.request.delete(`/api/club/${clubSlug}/members/${memberId}`),
    onMutate: async (memberId) => {
      await queryClient.cancelQueries(["members", clubSlug]);
      const previous = queryClient.getQueryData<Member[]>(["members", clubSlug]);
      queryClient.setQueryData<Member[]>(["members", clubSlug], (current) =>
        current?.filter((member) => member.id !== memberId),
      );
      return { previous };
    },
    onError: (_error, _memberId, context) => {
      if (isDefined(context?.previous)) {
        queryClient.setQueryData(["members", clubSlug], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries(["members", clubSlug]).catch(console.error);
      queryClient
        .invalidateQueries({
          queryKey: reviewsListKey(clubSlug),
        })
        .catch(console.error);
    },
  });
}

export function useInviteToken(clubSlug: string) {
  return useQuery({
    queryKey: ["invite-token", clubSlug],
    queryFn: async () => {
      const response = await axios.post<{ token: string }>(`/api/club/${clubSlug}/invite`);
      return response.data.token;
    },
  });
}

interface ClubSettings {
  features: {
    awards: boolean;
    discussionQuestions: boolean;
  };
}

interface ClubSettingsUpdate {
  features?: Partial<ClubSettings["features"]>;
}

export function useClubSettings(clubSlug: string): UseQueryReturnType<ClubSettings, unknown> {
  const auth = useAuthStore();
  return useQuery<ClubSettings>({
    queryKey: ["club", clubSlug, "settings"],
    queryFn: async () => {
      const response = await auth.request.get<ClubSettings>(`/api/club/${clubSlug}/settings`);
      return response.data;
    },
  });
}

export function useUpdateClubSettings(clubSlug: string) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (newSettings: ClubSettingsUpdate) =>
      auth.request.post(`/api/club/${clubSlug}/settings`, newSettings),
    onMutate: async (newSettings: ClubSettingsUpdate) => {
      await queryClient.cancelQueries(["club", clubSlug, "settings"]);

      const previousSettings = queryClient.getQueryData<ClubSettings>([
        "club",
        clubSlug,
        "settings",
      ]);

      if (previousSettings) {
        queryClient.setQueryData<ClubSettings>(["club", clubSlug, "settings"], {
          ...previousSettings,
          features: {
            ...previousSettings.features,
            ...newSettings.features,
          },
        });
      }

      return { previousSettings };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousSettings) {
        queryClient.setQueryData(["club", clubSlug, "settings"], context.previousSettings);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries(["club", clubSlug, "settings"]).catch(console.error);
    },
  });
}

export function useUpdateClubSlug(clubSlug: string) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (newSlug: string) =>
      auth.request.put<{ slug: string }>(`/api/club/${clubSlug}/slug`, {
        slug: newSlug,
      }),
    onSuccess: (response) => {
      const newSlug = response.data.slug;
      // The club guard on the new URL checks membership by slug, so the list
      // has to know the new one before the push rather than after a refetch.
      queryClient.setQueryData<ClubPreview[]>(userClubsKey, (current) =>
        current?.map((club) => (club.slug === clubSlug ? { ...club, slug: newSlug } : club)),
      );
      const previewed = queryClient.getQueryData<ClubPreview>(["club", clubSlug]);
      if (isDefined(previewed)) {
        queryClient.setQueryData<ClubPreview>(["club", newSlug], { ...previewed, slug: newSlug });
      }

      const currentRoute = router.currentRoute.value;
      router
        .push({
          name: currentRoute.name ?? undefined,
          params: { ...currentRoute.params, clubSlug: newSlug },
        })
        .then(() =>
          Promise.all([
            queryClient.invalidateQueries(["club"]),
            queryClient.invalidateQueries(userClubsKey),
          ]),
        )
        .catch(console.error);
    },
  });
}

export function useUpdateClubName(clubId: string) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) => auth.request.put(`/api/club/${clubId}/name`, { name }),
    onMutate: async (name) => {
      await Promise.all([
        queryClient.cancelQueries(["club", clubId], { exact: true }),
        queryClient.cancelQueries(userClubsKey),
      ]);
      const previousClub = queryClient.getQueryData<ClubPreview>(["club", clubId]);
      const previousClubs = queryClient.getQueryData<ClubPreview[]>(userClubsKey);
      if (isDefined(previousClub)) {
        queryClient.setQueryData<ClubPreview>(["club", clubId], {
          ...previousClub,
          clubName: name,
        });
      }
      queryClient.setQueryData<ClubPreview[]>(userClubsKey, (current) =>
        current?.map((club) => (club.slug === clubId ? { ...club, clubName: name } : club)),
      );
      return { previousClub, previousClubs };
    },
    onError: (_error, _name, context) => {
      if (isDefined(context?.previousClub)) {
        queryClient.setQueryData(["club", clubId], context.previousClub);
      }
      if (isDefined(context?.previousClubs)) {
        queryClient.setQueryData(userClubsKey, context.previousClubs);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries(["club", clubId]).catch(console.error);
      queryClient.invalidateQueries(userClubsKey).catch(console.error);
    },
  });
}
