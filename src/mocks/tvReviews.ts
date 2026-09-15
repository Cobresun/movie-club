import { http, HttpResponse } from "msw";
import { z } from "zod";

import { WorkType } from "../../lib/types/generated/db";
import { DetailedReviewListItem, ReviewScores } from "../../lib/types/lists";
import { formatTvAddress, TMDBTvEpisodeData, TvDataSummary } from "../../lib/types/tv";
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
 * test can score the show, a season or an episode — even a season or episode
 * nobody has scored, which is not on the list yet — and read the result back
 * off the screen after the refetch.
 *
 * `seasons` stands in for both TMDB's season endpoint and the server's cached
 * copy of it: which episodes exist, and so what a score on a show can name.
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

  /** The work at `externalId`, created from `data` if nobody has scored it. */
  const workAt = (externalId: string, data: TvDataSummary) => {
    const existing = list.find((item) => item.externalId === externalId);
    if (existing !== undefined) return existing;
    const created: DetailedReviewListItem = {
      id: `work-${externalId}`,
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

  /** What a score on `work`, narrowed by the body's numbers, lands on. */
  const resolveTarget = (
    work: DetailedReviewListItem,
    seasonNumber: number | undefined,
    episodeNumber: number | undefined,
  ) => {
    const show = asTv(work.externalData);
    if (show?.level !== "show" || seasonNumber === undefined) return work;

    const season = show.seasons?.find((option) => option.seasonNumber === seasonNumber);
    const series = { ...show, seasons: undefined, numberOfSeasons: undefined };
    if (episodeNumber === undefined) {
      if (season === undefined) return undefined;
      return workAt(formatTvAddress({ showId: show.showId, seasonNumber }), {
        ...series,
        level: "season",
        seasonNumber,
        title: season.name,
        episodeCount: season.episodeCount,
      });
    }

    const episode = seasons[seasonNumber]?.find(
      (option) => option.episode_number === episodeNumber,
    );
    if (episode === undefined) return undefined;
    const externalId = formatTvAddress({ showId: show.showId, seasonNumber, episodeNumber });
    return workAt(externalId, {
      ...series,
      level: "episode",
      seasonNumber,
      episodeNumber,
      title: episode.name ?? externalId,
    });
  };

  return [
    http.get("/api/club/:id/list/reviews", () => HttpResponse.json(list)),
    http.post("/api/club/:id/reviews", async ({ request }) => {
      const body = scoreBodySchema.parse(await request.json());
      const work = list.find((item) => item.id === body.workId);
      const target =
        work === undefined ? undefined : resolveTarget(work, body.seasonNumber, body.episodeNumber);
      if (target === undefined) return new HttpResponse(null, { status: 400 });

      list = list.map((item) =>
        item.id === target.id
          ? { ...item, scores: withScore(item.scores, userId, body.score) }
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
