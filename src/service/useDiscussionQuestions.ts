import { useQuery } from "@tanstack/vue-query";

import { DiscussionQuestionsResponse } from "../../lib/types/lists";
import { useAuthStore } from "@/stores/auth";

export function useDiscussionQuestions(clubSlug: string, workId: string) {
  const auth = useAuthStore();
  return useQuery<string[]>({
    queryKey: ["discussion-questions", clubSlug, workId],
    queryFn: async () => {
      const response = await auth.request.post<DiscussionQuestionsResponse>(
        `/api/club/${clubSlug}/reviews/${workId}/discussion-questions`,
      );
      return response.data.questions;
    },
    enabled: false,
    staleTime: Infinity,
    cacheTime: 1000 * 60 * 60 * 24 * 7,
    retry: false,
  });
}
