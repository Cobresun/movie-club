import {
  useMutation,
  useQuery,
  useQueryClient,
  UseQueryReturnType,
} from "@tanstack/vue-query";
import axios, { AxiosError } from "axios";
import { Ref } from "vue";

import { ClubAwards } from "@/common/types/models";
import { useAuthStore } from "@/stores/auth";

export function useAwardYears(
  clubId: string
): UseQueryReturnType<number[], AxiosError> {
  return useQuery({
    queryKey: ["awards-years", clubId],
    queryFn: async () =>
      (await axios.get(`/api/club/${clubId}/awards/years`)).data,
  });
}

export function useAwards(
  clubId: Ref<string>,
  year: Ref<string>,
  onSuccess?: (data: ClubAwards) => void
): UseQueryReturnType<ClubAwards, AxiosError> {
  return useQuery({
    queryKey: ["awards", clubId, year],
    queryFn: async () =>
      (await axios.get(`/api/club/${clubId.value}/awards/${year.value}`)).data,
    onSuccess,
  });
}

export function useAddCategory(clubId: string, year: string) {
  const { authToken } = useAuthStore();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (title: string) =>
      axios.post(
        `/api/club/${clubId}/awards/${year}/category`,
        { title },
        { headers: { Authorization: `Bearer ${authToken}` } }
      ),
    onMutate: async (title) => {
      await queryClient.cancelQueries(["awards", clubId, year]);
      queryClient.setQueryData<ClubAwards>(
        ["awards", clubId, year],
        (currentAwards) => {
          if (!currentAwards) return currentAwards;
          return {
            ...currentAwards,
            awards: [...currentAwards.awards, { title, nominations: [] }],
          };
        }
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries(["awards", clubId, year]);
    },
  });
}
