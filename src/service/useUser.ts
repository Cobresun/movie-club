import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { computed } from "vue";

import { ClubPreview, User } from "../../lib/types/club";
import { MemberScoredWork } from "../../lib/types/lists";
import { useAuthStore } from "@/stores/auth";

export function useUser() {
  const auth = useAuthStore();

  // Return session user data directly
  return computed<User | undefined>(() => {
    const user = auth.user;
    if (!user) return undefined;

    return {
      id: String(user.id),
      email: user.email,
      name: user.name,
      image: user.image ?? undefined,
    };
  });
}

export function useUserClubs() {
  const auth = useAuthStore();
  const isLoggedIn = computed(() => auth.isLoggedIn);

  return useQuery<ClubPreview[]>({
    queryKey: ["user", "clubs"],
    enabled: isLoggedIn,
    queryFn: async () => (await auth.request.get<ClubPreview[]>("/api/member/clubs")).data,
  });
}

export const memberScoresKey = ["user", "scores"] as const;

/**
 * Every work the signed-in member has scored, across all of their clubs. Score
 * Assist compares against this so its pool isn't limited to the club being
 * reviewed in.
 */
export function useMemberScores() {
  const auth = useAuthStore();
  const isLoggedIn = computed(() => auth.isLoggedIn);

  return useQuery<MemberScoredWork[]>({
    queryKey: memberScoresKey,
    enabled: isLoggedIn,
    queryFn: async () => (await auth.request.get<MemberScoredWork[]>("/api/member/scores")).data,
  });
}

/**
 * What a profile edit changes beyond the row it wrote: the session the whole
 * app reads its own name and avatar from, and the member lists every club
 * renders them in.
 */
function useProfileRefresh() {
  const auth = useAuthStore();
  const queryClient = useQueryClient();

  return () => {
    auth.refreshSession().catch(console.error);
    queryClient.invalidateQueries(["members"]).catch(console.error);
  };
}

export function useUpdateAvatar() {
  const auth = useAuthStore();
  const refreshProfile = useProfileRefresh();
  return useMutation({
    mutationFn: async (formData: FormData) =>
      await auth.request.post(`/api/member/avatar`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }),
    onSettled: refreshProfile,
  });
}

export function useDeleteAvatar() {
  const auth = useAuthStore();
  const refreshProfile = useProfileRefresh();
  return useMutation({
    mutationFn: async () => await auth.request.delete(`/api/member/avatar`),
    onSettled: refreshProfile,
  });
}

export function useUpdateName() {
  const auth = useAuthStore();
  const refreshProfile = useProfileRefresh();
  return useMutation({
    mutationFn: async (name: string) => await auth.request.put(`/api/member/name`, { name }),
    onSettled: refreshProfile,
  });
}
