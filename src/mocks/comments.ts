import { http, HttpResponse } from "msw";

import { WorkCommentDto } from "../../lib/types/lists";

export const comment = (overrides: Partial<WorkCommentDto> & { id: string }): WorkCommentDto => ({
  workId: "work-1",
  userId: "u-1",
  userName: "Alice",
  content: "First thoughts",
  createdDate: "2024-01-01T00:00:00.000Z",
  spoiler: false,
  ...overrides,
});

/**
 * A comment thread that keeps what the mutations send it, so a test can post,
 * edit or delete and then read the result back through the thread query — the
 * same round trip the API gives the app.
 */
export const commentsApi = (initial: WorkCommentDto[] = []) => {
  let thread = [...initial];
  const base = "/api/club/:id/reviews/:workId/comments";

  return [
    http.get(base, () => HttpResponse.json(thread)),
    http.post(base, async ({ request }) => {
      const { content, spoiler } = (await request.json()) as { content: string; spoiler: boolean };
      thread = [...thread, comment({ id: `c-${thread.length + 1}`, content, spoiler })];
      return HttpResponse.json({});
    }),
    http.put(`${base}/:commentId`, async ({ request, params }) => {
      const { content, spoiler } = (await request.json()) as { content: string; spoiler: boolean };
      thread = thread.map((existing) =>
        existing.id === params.commentId ? { ...existing, content, spoiler } : existing,
      );
      return HttpResponse.json({});
    }),
    http.delete(`${base}/:commentId`, ({ params }) => {
      thread = thread.filter((existing) => existing.id !== params.commentId);
      return HttpResponse.json({});
    }),
  ];
};
