import { useQuery, UseQueryReturnType } from "@tanstack/vue-query";
import axios, { AxiosError } from "axios";

export function useAwardYears(
  clubId: string
): UseQueryReturnType<number[], AxiosError> {
  return useQuery({
    queryKey: ["awards-years", clubId],
    queryFn: async () =>
      (await axios.get(`/api/club/${clubId}/awards/years`)).data,
  });
}
