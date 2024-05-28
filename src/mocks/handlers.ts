import { rest } from "msw";

import club from "./data/club.json";
import member from "./data/member.json";
import members from "./data/members.json";
import reviews from "./data/reviews.json";
import TMDBSearch from "./data/TMDBSearch.json";
import watchlist from "./data/watchlist.json";

export const handlers = [
  rest.get("/api/member", (req, res, ctx) => {
    return res(ctx.status(200), ctx.json(member));
  }),
  rest.get("/api/club/:id", (req, res, ctx) => {
    return res(ctx.status(200), ctx.json(club));
  }),
  rest.get("/api/club/:id/members", (req, res, ctx) => {
    return res(ctx.status(200), ctx.json(members));
  }),
  rest.get("/api/club/:id/list/reviews", (req, res, ctx) => {
    return res(ctx.status(200), ctx.json(reviews));
  }),
  rest.put("/api/club/:id/list/reviews/:movieId", (req, res, ctx) => {
    return res(ctx.status(200));
  }),
  rest.get("/api/club/:id/list/watchlist", (req, res, ctx) => {
    return res(ctx.status(200), ctx.json(watchlist));
  }),
  rest.get(`https://api.themoviedb.org/3/search/movie`, (req, res, ctx) => {
    return res(ctx.status(200), ctx.json(TMDBSearch));
  }),
];
