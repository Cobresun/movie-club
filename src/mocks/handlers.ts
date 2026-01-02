import { http, HttpResponse } from "msw";

import club from "./data/club.json";
import member from "./data/member.json";
import members from "./data/members.json";
import reviews from "./data/reviews.json";
import TMDBSearch from "./data/TMDBSearch.json";
import watchlist from "./data/watchlist.json";

export const handlers = [
  http.get("/api/member", () => {
    return HttpResponse.json(member);
  }),
  http.get("/api/member/clubs", () => {
    return HttpResponse.json([club]);
  }),
  http.get("/api/club/:id", () => {
    return HttpResponse.json(club);
  }),
  http.get("/api/club/:id/members", () => {
    return HttpResponse.json(members);
  }),
  http.get("/api/club/:id/list/reviews", () => {
    return HttpResponse.json(reviews);
  }),
  http.post("/api/club/:id/reviews", () => {
    return new HttpResponse(null, { status: 200 });
  }),
  http.put("/api/club/:id/reviews/:reviewId", () => {
    return new HttpResponse(null, { status: 200 });
  }),
  http.get("/api/club/:id/list/watchlist", () => {
    return HttpResponse.json(watchlist);
  }),
  http.get(`https://api.themoviedb.org/3/search/movie`, () => {
    return HttpResponse.json(TMDBSearch);
  }),
];
