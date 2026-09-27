import { http, HttpResponse } from "msw";

import { ClubPreview, ClubSettings, InviteTokenResponse, Member } from "../../lib/types/club";
import {
  ClubListSummary,
  DetailedReviewListItem,
  DetailedWorkData,
  DetailedWorkListItem,
  MemberScoredWork,
  ReviewScores,
  ReviewsListIdResponse,
  UserListItemWithSource,
  WorkCommentDto,
} from "../../lib/types/lists";
import { SiteMetrics, SnapshotHistoryPoint, siteMetricsSchema } from "../../lib/types/metrics";
import { MovieCastMember, TMDBWatchProvidersResponse } from "../../lib/types/movie";
import adminMetrics from "./data/adminMetrics.json";
import club from "./data/club";
import googleBooksSearch from "./data/googleBooksSearch.json";
import members from "./data/members.json";
import reviews from "./data/reviews";
import TMDBSearch from "./data/TMDBSearch.json";
import watchlist from "./data/watchlist";

export const handlers = [
  http.get("/api/auth/get-session", () => {
    return HttpResponse.json(null);
  }),
  http.get("/api/admin/metrics", () => {
    return HttpResponse.json<SiteMetrics>(siteMetricsSchema.parse(adminMetrics));
  }),
  http.get("/api/admin/metrics/history", () => {
    return HttpResponse.json<SnapshotHistoryPoint[]>([]);
  }),
  http.get("/api/member/clubs", () => {
    return HttpResponse.json<ClubPreview[]>([club]);
  }),
  http.get("/api/member/scores", () => {
    return HttpResponse.json<MemberScoredWork[]>([]);
  }),
  http.put("/api/member/name", () => {
    return new HttpResponse(null, { status: 200 });
  }),
  http.post("/api/member/avatar", () => {
    return new HttpResponse(null, { status: 200 });
  }),
  http.delete("/api/member/avatar", () => {
    return new HttpResponse(null, { status: 200 });
  }),
  http.get("/api/club/:id", () => {
    return HttpResponse.json<ClubPreview>(club);
  }),
  http.get("/api/club/:id/members", () => {
    return HttpResponse.json<Member[]>(members);
  }),
  http.post("/api/club/:id/invite", () => {
    return HttpResponse.json<InviteTokenResponse>({ token: "test-invite-token" });
  }),
  http.get("/api/club/:id/settings", () => {
    return HttpResponse.json<ClubSettings>({
      features: { awards: false, discussionQuestions: false },
    });
  }),
  http.get("/api/club/:id/list/reviews-id", () => {
    return HttpResponse.json<ReviewsListIdResponse>({ id: "reviews" });
  }),
  http.get("/api/club/:id/reviews/:workId/comments", () => {
    return HttpResponse.json<WorkCommentDto[]>([]);
  }),
  http.get("/api/club/:id/list/reviews", () => {
    return HttpResponse.json<DetailedReviewListItem[]>(reviews);
  }),
  http.post("/api/club/:id/reviews", () => {
    return new HttpResponse(null, { status: 200 });
  }),
  http.put("/api/club/:id/reviews/:reviewId", () => {
    return new HttpResponse(null, { status: 200 });
  }),
  http.delete("/api/club/:id/reviews/:reviewId", () => {
    return new HttpResponse(null, { status: 200 });
  }),
  http.get("/api/club/:id/reviews/:workId/scores", () => {
    return HttpResponse.json<ReviewScores>(reviews[0]?.scores ?? {});
  }),
  http.get("/api/club/:id/list", () => {
    return HttpResponse.json<ClubListSummary[]>([
      { id: "1", title: "Watch List", systemType: null, itemCount: 1 },
    ]);
  }),
  // Registered before /list/:listId semantics apply client-side: MSW matches
  // in array order, mirroring the backend's literal-before-param routing.
  http.get("/api/club/:id/list/all-items", () => {
    return HttpResponse.json<UserListItemWithSource[]>(
      watchlist.map((item) => ({
        ...item,
        sourceListId: "1",
        sourceListTitle: "Watch List",
      })),
    );
  }),
  http.get("/api/club/:id/list/1", () => {
    return HttpResponse.json<DetailedWorkListItem[]>(watchlist);
  }),
  http.get("/api/club/:id/work/:workId/details", () => {
    return HttpResponse.json<DetailedWorkData | null>(null);
  }),
  http.get("/api/club/:id/reviews/cast", () => {
    return HttpResponse.json<Record<string, MovieCastMember[]>>({});
  }),
  http.get(`https://api.themoviedb.org/3/search/movie`, () => {
    return HttpResponse.json(TMDBSearch);
  }),
  http.get(`https://api.themoviedb.org/3/movie/:movieId/watch/providers`, ({ params }) => {
    return HttpResponse.json<TMDBWatchProvidersResponse>({
      id: Number(params.movieId),
      results: {},
    });
  }),
  http.get(`https://www.googleapis.com/books/v1/volumes`, () => {
    return HttpResponse.json(googleBooksSearch);
  }),
  http.get(`https://www.googleapis.com/books/v1/volumes/:volumeId`, () => {
    return HttpResponse.json(googleBooksSearch.items[0]);
  }),
];
