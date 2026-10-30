import { http, HttpResponse } from "msw";
import { z } from "zod";

import { WorkType } from "../../lib/types/generated/db";
import { type DetailedReviewListItem } from "../../lib/types/lists";
import {
  formatTvAddress,
  parseTvAddress,
  type TMDBTvEpisodeData,
  type TvDataSummary,
} from "../../lib/types/tv";
import { asTv } from "../common/clubType/tv/data";
import { withMemberScore } from "../features/reviews/episodeCards";

const addBodySchema = z.object({ externalId: z.string() });

const scoreBodySchema = z.object({
  workId: z.string(),
  score: z.number(),
  childExternalId: z.string().optional(),
});

/**
 * A TV club's reviews list and TMDB's season listings, kept together so a
 * test can score the show or an episode — even an episode nobody has scored,
 * which is not on the list yet — and read the result back off the screen after
 * the refetch.
 *
 * `seasons` stands in for both TMDB's season endpoint and the server's cached
 * copy of it: which episodes exist, and so what a score on a show can name.
 * `catalog` holds the shows the club can add, or move onto the reviews list
 * from another list, as the server returns them once there.
 */
export const tvReviewsApi = ({
  reviews,
  userId,
  seasons,
  catalog = [],
}: {
  reviews: DetailedReviewListItem[];
  userId: string;
  seasons: Record<number, TMDBTvEpisodeData[]>;
  catalog?: DetailedReviewListItem[];
}) => {
  let list = [...reviews];

  /** The child of `parentId` at `externalId`, created from `data` if nobody has scored it. */
  const workAt = (parentId: string, externalId: string, data: TvDataSummary) => {
    const existing = list.find((item) => item.externalId === externalId);
    if (existing !== undefined) return existing;
    const created: DetailedReviewListItem = {
      id: `work-${externalId}`,
      parentId,
      type: WorkType.tv,
      title: data.title,
      createdDate: new Date().toISOString(),
      externalId,
      scores: {},
      externalData: data,
    };
    list = [...list, created];
    return created;
  };

  /** What a score on `work`, or on the child of it the body names, lands on. */
  const resolveTarget = (work: DetailedReviewListItem, childExternalId: string | undefined) => {
    if (childExternalId === undefined) return work;
    const show = asTv(work.externalData);
    const child = parseTvAddress(childExternalId);
    if (show?.level !== "show" || child?.showId !== show.showId) return undefined;

    // A season is never scored on its own, so only an episode can be named.
    const { seasonNumber, episodeNumber } = child;
    if (seasonNumber === undefined || episodeNumber === undefined) return undefined;
    const series = { ...show, seasons: undefined, numberOfSeasons: undefined };

    const episode = seasons[seasonNumber]?.find(
      (option) => option.episode_number === episodeNumber,
    );
    if (episode === undefined) return undefined;
    const externalId = formatTvAddress({ showId: show.showId, seasonNumber, episodeNumber });
    return workAt(work.id, externalId, {
      ...series,
      level: "episode",
      seasonNumber,
      episodeNumber,
      title: episode.name ?? externalId,
    });
  };

  return [
    http.get("/api/club/:id/list/reviews", () => HttpResponse.json(list)),
    http.post("/api/club/:id/list/:listId/items", async ({ request }) => {
      const { externalId } = addBodySchema.parse(await request.json());
      const show = catalog.find((item) => item.externalId === externalId);
      if (show === undefined) return new HttpResponse(null, { status: 400 });
      list = [{ ...show, createdDate: new Date().toISOString() }, ...list];
      return new HttpResponse(null, { status: 200 });
    }),
    http.delete("/api/club/:id/list/:listId/items/:workId", ({ params }) => {
      list = list.filter((item) => item.id !== params.workId && item.parentId !== params.workId);
      return new HttpResponse(null, { status: 200 });
    }),
    http.post("/api/club/:id/list/:listId/items/:workId/move", ({ params }) => {
      const show = catalog.find((item) => item.id === params.workId);
      if (show === undefined) return new HttpResponse(null, { status: 400 });
      list = [{ ...show, createdDate: new Date().toISOString() }, ...list];
      return new HttpResponse(null, { status: 200 });
    }),
    http.post("/api/club/:id/reviews", async ({ request }) => {
      const body = scoreBodySchema.parse(await request.json());
      const work = list.find((item) => item.id === body.workId);
      const target = work === undefined ? undefined : resolveTarget(work, body.childExternalId);
      if (target === undefined) return new HttpResponse(null, { status: 400 });

      list = list.map((item) =>
        item.id === target.id
          ? { ...item, scores: withMemberScore(item.scores, userId, body.score, `r-${userId}`) }
          : item,
      );
      return new HttpResponse(null, { status: 200 });
    }),
    http.get("https://api.themoviedb.org/3/tv/:showId/season/:seasonNumber", ({ params }) => {
      const seasonNumber = Number(params.seasonNumber);
      return HttpResponse.json({
        season_number: seasonNumber,
        name: `Season ${seasonNumber}`,
        overview: `Everything that happens in season ${seasonNumber}.`,
        poster_path: null,
        episodes: seasons[seasonNumber] ?? [],
      });
    }),
  ];
};
