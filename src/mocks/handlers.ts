import { http, HttpResponse } from "msw";

import {
  type ClubPreview,
  type ClubSettings,
  type InviteTokenResponse,
  type Member,
} from "../../lib/types/club";
import {
  type ClubListSummary,
  type DetailedReviewListItem,
  type DetailedWorkData,
  type DetailedWorkListItem,
  type MemberScoredWork,
  type ReviewScores,
  type ReviewsListIdResponse,
  type UserListItemWithSource,
  type WorkCommentDto,
} from "../../lib/types/lists";
import {
  type AdminDashboard,
  adminDashboardSchema,
  type SnapshotHistoryPoint,
} from "../../lib/types/metrics";
import { type TMDBWatchProvidersResponse } from "../../lib/types/movie";
import { type CastMember } from "../../lib/types/tmdb";
import adminMetrics from "./data/adminMetrics.json";
import club from "./data/club";
import googleBooksSearch from "./data/googleBooksSearch.json";
import members from "./data/members.json";
import reviews from "./data/reviews";
import TMDBSearch from "./data/TMDBSearch.json";
import watchlist from "./data/watchlist";

export const handlers = [
  http.get("/api/auth/get-session", () => HttpResponse.json(null)),
  http.get("/api/admin/metrics", () =>
    HttpResponse.json<AdminDashboard>(adminDashboardSchema.parse(adminMetrics)),
  ),
  http.get("/api/admin/metrics/history", () => HttpResponse.json<SnapshotHistoryPoint[]>([])),
  http.get("/api/member/clubs", () => HttpResponse.json<ClubPreview[]>([club])),
  http.get("/api/member/scores", () => HttpResponse.json<MemberScoredWork[]>([])),
  http.put("/api/member/name", () => new HttpResponse(null, { status: 200 })),
  http.post("/api/member/avatar", () => new HttpResponse(null, { status: 200 })),
  http.delete("/api/member/avatar", () => new HttpResponse(null, { status: 200 })),
  http.get("/api/club/:id", () => HttpResponse.json<ClubPreview>(club)),
  http.get("/api/club/:id/members", () => HttpResponse.json<Member[]>(members)),
  http.post("/api/club/:id/invite", () =>
    HttpResponse.json<InviteTokenResponse>({ token: "test-invite-token" }),
  ),
  http.get("/api/club/:id/settings", () =>
    HttpResponse.json<ClubSettings>({
      features: { awards: false, discussionQuestions: false },
    }),
  ),
  http.get("/api/club/:id/nextWork", () => HttpResponse.json({})),
  http.get("/api/club/:id/list/reviews-id", () =>
    HttpResponse.json<ReviewsListIdResponse>({ id: "reviews" }),
  ),
  http.get("/api/club/:id/reviews/:workId/comments", () => HttpResponse.json<WorkCommentDto[]>([])),
  http.get("/api/club/:id/list/reviews", () =>
    HttpResponse.json<DetailedReviewListItem[]>(reviews),
  ),
  http.post("/api/club/:id/reviews", () => new HttpResponse(null, { status: 200 })),
  http.put("/api/club/:id/reviews/:reviewId", () => new HttpResponse(null, { status: 200 })),
  http.delete("/api/club/:id/reviews/:reviewId", () => new HttpResponse(null, { status: 200 })),
  http.get("/api/club/:id/reviews/:workId/scores", () =>
    HttpResponse.json<ReviewScores>(reviews[0]?.scores ?? {}),
  ),
  http.get("/api/club/:id/list", () =>
    HttpResponse.json<ClubListSummary[]>([
      { id: "1", title: "Watch List", systemType: null, itemCount: 1 },
    ]),
  ),
  // Registered before /list/:listId semantics apply client-side: MSW matches
  // in array order, mirroring the backend's literal-before-param routing.
  http.get("/api/club/:id/list/all-items", () =>
    HttpResponse.json<UserListItemWithSource[]>(
      watchlist.map((item) => ({
        ...item,
        sourceListId: "1",
        sourceListTitle: "Watch List",
      })),
    ),
  ),
  http.get("/api/club/:id/list/1", () => HttpResponse.json<DetailedWorkListItem[]>(watchlist)),
  http.get("/api/club/:id/work/:workId/details", () =>
    HttpResponse.json<DetailedWorkData | null>(null),
  ),
  http.get("/api/club/:id/reviews/cast", () => HttpResponse.json<Record<string, CastMember[]>>({})),
  http.get(`https://api.themoviedb.org/3/search/movie`, () => HttpResponse.json(TMDBSearch)),
  http.get(`https://api.themoviedb.org/3/movie/:movieId/watch/providers`, ({ params }) =>
    HttpResponse.json<TMDBWatchProvidersResponse>({
      id: Number(params.movieId),
      results: {},
    }),
  ),
  http.get(`https://www.googleapis.com/books/v1/volumes`, () =>
    HttpResponse.json(googleBooksSearch),
  ),
  http.get(`https://www.googleapis.com/books/v1/volumes/:volumeId`, () =>
    HttpResponse.json(googleBooksSearch.items[0]),
  ),
];
