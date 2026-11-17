import { useQuery } from "@tanstack/vue-query";
import { type MaybeRef } from "vue";

import { type WorkRecommendation } from "../../lib/types/recommendations";
import { http } from "@/common/http";

export const recommendationsKey = (clubSlug: string) => ["recommendations", clubSlug] as const;

export function useRecommendations(clubSlug: string, enabled: MaybeRef<boolean>) {
  return useQuery({
    queryKey: recommendationsKey(clubSlug),
    enabled,
    queryFn: async () =>
      (await http.get<WorkRecommendation[]>(`/api/club/${clubSlug}/recommendations`)).data,
  });
}
