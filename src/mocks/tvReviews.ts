import { http, HttpResponse } from "msw";
import { z } from "zod";

import { WorkType } from "../../lib/types/generated/db";
import { DetailedReviewListItem, ReviewScores } from "../../lib/types/lists";
import { formatTvAddress, TMDBTvEpisodeData } from "../../lib/types/tv";
import { asTv } from "../common/workDisplay";

const scoreBodySchema = z.object({
  workId: z.string(),
  score: z.number(),
  seasonNumber: z.number().optional(),
  episodeNumber: z.number().optional(),
});

function withScore(scores: ReviewScores, userId: string, score: number): ReviewScores {
  const members: ReviewScores = Object.fromEntries(
    Object.entries(scores).filter(([key]) => key !== "average"),
  );
  const createdDate = new Date().toISOString();
  members[userId] = { id: `r-${userId}`, created_date: createdDate, score };
  const values = Object.values(members).map((review) => review.score);
  return {
    ...members,
    average: {
      id: "average",
      created_date: createdDate,
      score: values.reduce((total, value) => total + value, 0) / values.length,
    },
  };
}

/**
 * A TV club's reviews list and TMDB's season listings, kept together so a
 * test can score an episode — even one nobody has scored, which is not on the
 * list yet — and read the result back off the screen after the refetch.
 *
 * `seasons` stands in for both TMDB's season endpoint and the server's cached
 * copy of it: which episodes exist, and what a score on a show resolves to.
 */
export const tvReviewsApi = ({
  reviews,
  userId,
  seasons,
}: {
  reviews: DetailedReviewListItem[];
  userId: string;
  seasons: Record<number, TMDBTvEpisodeData[]>;
}) => {
  let list = [...reviews];

  const scoreEpisode = (
    show: DetailedReviewListItem,
    episode: TMDBTvEpisodeData,
    score: number,
  ) => {
    const showData = asTv(show.externalData);
    if (showData === undefined) return;
    const externalId = formatTvAddress({
      showId: showData.showId,
      seasonNumber: episode.season_number,
      episodeNumber: episode.episode_number,
    });
    const existing = list.find((item) => item.externalId === externalId);
    if (existing !== undefined) {
      list = list.map((item) =>
        item === existing ? { ...item, scores: withScore(item.scores, userId, score) } : item,
      );
      return;
    }
    list = [
      ...list,
      {
        id: `work-${externalId}`,
        type: WorkType.tv,
        title: episode.name ?? externalId,
        createdDate: new Date().toISOString(),
        externalId,
        scores: withScore({}, userId, score),
        externalData: {
          ...showData,
          level: "episode",
          seasons: undefined,
          seasonNumber: episode.season_number,
          episodeNumber: episode.episode_number,
          title: episode.name ?? externalId,
        },
      },
    ];
  };

  return [
    http.get("/api/club/:id/list/reviews", () => HttpResponse.json(list)),
    http.post("/api/club/:id/reviews", async ({ request }) => {
      const body = scoreBodySchema.parse(await request.json());
      const show = list.find((item) => item.id === body.workId);
      if (show === undefined || body.seasonNumber === undefined) {
        return new HttpResponse(null, { status: 400 });
      }
      const episodes = (seasons[body.seasonNumber] ?? []).filter(
        (episode) =>
          body.episodeNumber === undefined || episode.episode_number === body.episodeNumber,
      );
      if (episodes.length === 0) return new HttpResponse(null, { status: 400 });
      for (const episode of episodes) scoreEpisode(show, episode, body.score);
      return HttpResponse.json({ scoredWorks: episodes.length });
    }),
    http.get("https://api.themoviedb.org/3/tv/:showId/season/:seasonNumber", ({ params }) => {
      const seasonNumber = Number(params.seasonNumber);
      return HttpResponse.json({
        season_number: seasonNumber,
        poster_path: null,
        episodes: seasons[seasonNumber] ?? [],
      });
    }),
  ];
};
