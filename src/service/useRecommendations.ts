import { useQuery } from "@tanstack/vue-query";
import axios from "axios";
import { type MaybeRef } from "vue";

import { type WorkRecommendation } from "../../lib/types/recommendations";

export const recommendationsKey = (clubSlug: string) => ["recommendations", clubSlug] as const;

export function useRecommendations(clubSlug: string, enabled: MaybeRef<boolean>) {
  return useQuery({
    queryKey: recommendationsKey(clubSlug),
    enabled,
    queryFn: async () =>
      (await axios.get<WorkRecommendation[]>(`/api/club/${clubSlug}/recommendations`)).data,
  });
}
