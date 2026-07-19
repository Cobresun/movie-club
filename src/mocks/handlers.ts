import { http, HttpResponse } from "msw";

import club from "./data/club.json";
import googleBooksSearch from "./data/googleBooksSearch.json";
import member from "./data/member.json";
import members from "./data/members.json";
import meWatches from "./data/meWatches.json";
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
  http.get("/api/club/:id/settings", () => {
    return HttpResponse.json({});
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
  http.get("/api/club/:id/reviews/:workId/scores", () => {
    return HttpResponse.json(reviews[0]?.scores ?? {});
  }),
  http.get("/api/club/:id/list", () => {
    return HttpResponse.json([
      { id: "1", title: "Watch List", systemType: null, itemCount: 1 },
    ]);
  }),
  http.get("/api/club/:id/list/1", () => {
    return HttpResponse.json(watchlist);
  }),
  http.get("/api/me/watches/for-work", () => {
    return HttpResponse.json([]);
  }),
  http.get("/api/me/watches/work-details", () => {
    return HttpResponse.json(null);
  }),
  http.get("/api/me/watches", () => {
    return HttpResponse.json(meWatches);
  }),
  http.post("/api/me/watches", () => {
    return HttpResponse.json({ watchId: "new-watch" });
  }),
  http.put("/api/me/watches/:watchId", () => {
    return new HttpResponse(null, { status: 200 });
  }),
  http.delete("/api/me/watches/:watchId", () => {
    return new HttpResponse(null, { status: 200 });
  }),
  http.get(`https://api.themoviedb.org/3/search/movie`, () => {
    return HttpResponse.json(TMDBSearch);
  }),
  // No region providers by default: keeps the "Where to watch" section hidden
  // and, crucially, stops the drawer's WatchProviders from opening a real TMDB
  // socket in jsdom (an unmocked request there crashes the worker on teardown).
  http.get(
    `https://api.themoviedb.org/3/movie/:externalId/watch/providers`,
    () => {
      return HttpResponse.json({ id: 0, results: {} });
    },
  ),
  http.get(`https://www.googleapis.com/books/v1/volumes`, () => {
    return HttpResponse.json(googleBooksSearch);
  }),
  http.get(`https://www.googleapis.com/books/v1/volumes/:volumeId`, () => {
    return HttpResponse.json(googleBooksSearch.items[0]);
  }),
];
