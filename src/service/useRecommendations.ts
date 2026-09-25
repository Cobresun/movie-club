import { useQuery } from "@tanstack/vue-query";
import axios from "axios";
import { MaybeRef } from "vue";

import { WorkRecommendation } from "../../lib/types/recommendations";

export const recommendationsKey = (clubSlug: string) => ["recommendations", clubSlug] as const;

export function useRecommendations(clubSlug: string, enabled: MaybeRef<boolean>) {
  return useQuery({
    queryKey: recommendationsKey(clubSlug),
    enabled,
    queryFn: async () =>
      (await axios.get<WorkRecommendation[]>(`/api/club/${clubSlug}/recommendations`)).data,
  });
}
