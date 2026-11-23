import { useQuery } from "@tanstack/vue-query";
import { computed, type MaybeRefOrGetter, toValue } from "vue";
import { z } from "zod";

import { hasValue } from "../../lib/checks/checks.js";
import { giphyIdSchema } from "../../lib/giphy";
import { http } from "@/common/http";

const PAGE_SIZE = 24;

const gifSchema = z.object({ id: giphyIdSchema, title: z.string() });

export type Gif = z.infer<typeof gifSchema>;

const responseSchema = z.object({ data: z.array(z.unknown()) });

/**
 * GIPHY's trending GIFs for an empty query, its search results otherwise. A
 * result whose id the comment endpoint would refuse is dropped here rather
 * than failing the whole page.
 */
export function useGifSearch(query: MaybeRefOrGetter<string>) {
  const trimmed = computed(() => toValue(query).trim());
  return useQuery<Gif[]>({
    queryKey: computed(() => ["giphy", trimmed.value]),
    // GIPHY rate-limits each key per hour, and the same search typed twice
    // in a session has no reason to spend another call.
    staleTime: 1000 * 60 * 60,
    queryFn: async ({ signal }) => {
      const params: Record<string, string> = {
        api_key: import.meta.env.VITE_GIPHY_API_KEY,
        limit: String(PAGE_SIZE),
        rating: "pg-13",
      };
      if (hasValue(trimmed.value)) params.q = trimmed.value;
      const { data } = await http.get(
        `https://api.giphy.com/v1/gifs/${hasValue(trimmed.value) ? "search" : "trending"}`,
        { signal, params },
      );
      return responseSchema.parse(data).data.flatMap((item) => {
        const parsed = gifSchema.safeParse(item);
        return parsed.success ? [parsed.data] : [];
      });
    },
  });
}
