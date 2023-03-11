import { useQuery, UseQueryReturnType } from "@tanstack/vue-query";
import axios, { AxiosError } from "axios";
import { Ref } from "vue";

import { ClubAwards } from "@/common/types/models";

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
