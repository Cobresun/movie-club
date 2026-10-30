import { http, HttpResponse } from "msw";
import { z } from "zod";

import { type ClubListSummary } from "../../lib/types/lists";

const titlePayloadSchema = z.object({
  title: z.string(),
});

const reorderPayloadSchema = z.object({
  listIds: z.array(z.string()),
});

export const clubList = (
  overrides: Partial<ClubListSummary> & { id: string },
): ClubListSummary => ({
  title: "Watch List",
  systemType: null,
  itemCount: 0,
  ...overrides,
});

/**
 * A club's set of lists that keeps what the mutations send it, so a test can
 * create, rename, reorder or delete and then read the result back off the
 * screen — the same round trip the API gives the app.
 *
 * The list mutations are all optimistic and refetch in `onSettled`, so a fake
 * that forgets the write would show the change and then take it away again;
 * asserting on the visible outcome needs a fake that actually remembers.
 */
export const clubListsApi = (
  initial: ClubListSummary[] = [clubList({ id: "1", itemCount: 1 })],
) => {
  let lists = [...initial];
  const base = "/api/club/:id/list";

  return [
    http.get(base, () => HttpResponse.json<ClubListSummary[]>(lists)),
    http.post(base, async ({ request }) => {
      const { title } = titlePayloadSchema.parse(await request.json());
      const created = clubList({ id: `list-${lists.length + 1}`, title });
      lists = [...lists, created];
      return HttpResponse.json<ClubListSummary>(created);
    }),
    http.put(`${base}/reorder`, async ({ request }) => {
      const { listIds } = reorderPayloadSchema.parse(await request.json());
      lists = listIds.flatMap((id) => lists.filter((list) => list.id === id));
      return new HttpResponse(null, { status: 200 });
    }),
    http.put(`${base}/:listId`, async ({ request, params }) => {
      const { title } = titlePayloadSchema.parse(await request.json());
      lists = lists.map((list) => (list.id === params.listId ? { ...list, title } : list));
      return new HttpResponse(null, { status: 200 });
    }),
    http.delete(`${base}/:listId`, ({ params }) => {
      lists = lists.filter((list) => list.id !== params.listId);
      return new HttpResponse(null, { status: 200 });
    }),
  ];
};
