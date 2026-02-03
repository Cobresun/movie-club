import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { computed } from "vue";

import { ClubPreview, Member } from "../../lib/types/club";

import { useAuthStore } from "@/stores/auth";

export function useUser() {
  const auth = useAuthStore();
  const email = computed(() => auth.user?.email ?? "");
  const isLoggedIn = computed(() => auth.isLoggedIn);

  return useQuery<Member>({
    queryKey: ["user", email],
    enabled: isLoggedIn,
    queryFn: async () => (await auth.request.get<Member>(`/api/member`)).data,
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
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (formData: FormData) =>
      await auth.request.post(`/api/member/avatar`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }),
    onSettled: () => {
      queryClient
        .invalidateQueries({ queryKey: ["user", auth.user?.email ?? ""] })
        .catch(console.error);
    },
  });
}

export function useDeleteAvatar() {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => await auth.request.delete(`/api/member/avatar`),
    onSettled: () => {
      queryClient
        .invalidateQueries({ queryKey: ["user", auth.user?.email ?? ""] })
        .catch(console.error);
    },
  });
}
