import { useMutation, useQuery } from "@tanstack/vue-query";
import { computed } from "vue";

import { ClubPreview, User } from "../../lib/types/club";

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
    queryFn: async () =>
      (await auth.request.get<ClubPreview[]>("/api/member/clubs")).data,
  });
}

export function useUpdateAvatar() {
  const auth = useAuthStore();
  return useMutation({
    mutationFn: async (formData: FormData) =>
      await auth.request.post(`/api/member/avatar`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }),
    onSettled: () => {
      // Refresh session to get updated user data
      auth.refreshSession().catch(console.error);
    },
  });
}

export function useDeleteAvatar() {
  const auth = useAuthStore();
  return useMutation({
    mutationFn: async () => await auth.request.delete(`/api/member/avatar`),
    onSettled: () => {
      // Refresh session to get updated user data
      auth.refreshSession().catch(console.error);
    },
  });
}

export function useUpdateName() {
  const auth = useAuthStore();
  return useMutation({
    mutationFn: async (name: string) =>
      await auth.request.put(`/api/member/name`, { name }),
    onSettled: () => {
      // Refresh session to get updated user data
      auth.refreshSession().catch(console.error);
    },
  });
}
