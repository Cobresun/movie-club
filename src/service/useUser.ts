import { useMutation, useQuery } from "@tanstack/vue-query";
import { computed } from "vue";

import { ClubPreview } from "../../lib/types/club";

import { authClient } from "@/lib/auth-client";
import { useAuthStore } from "@/stores/auth";

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
    mutationFn: async (formData: FormData) => {
      const response = await auth.request.post<{
        url: string;
        imageId: string;
      }>(`/api/member/avatar`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      return response.data;
    },
    onSuccess: async (data) => {
      // Call BetterAuth's updateUser to trigger automatic session refresh
      await authClient.updateUser({
        image: data.url,
      });
    },
  });
}

export function useDeleteAvatar() {
  const auth = useAuthStore();
  return useMutation({
    mutationFn: async () => await auth.request.delete(`/api/member/avatar`),
    onSuccess: async () => {
      await authClient.updateUser({
        image: null,
      });
    },
  });
}
