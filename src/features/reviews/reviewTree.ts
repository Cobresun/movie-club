import { isDefined } from "../../../lib/checks/checks.js";
import { DetailedReviewListItem, ReviewScores } from "../../../lib/types/lists";
import { TvDataSummary, TvSeasonSummary } from "../../../lib/types/tv";
import { asTv } from "@/common/workDisplay";

/** One episode on the reviews list. */
export interface EpisodeNode {
  workId: string;
  episodeNumber: number;
  title: string;
  airDate?: string;
  review: DetailedReviewListItem;
  scored: boolean;
}

/** A season's or show's scores, each member's either set at that level or
 * averaged from the level below. */
export interface LevelScores {
  scores: ReviewScores;
  /** Members whose score here is averaged from the level below, not set. */
  averagedMemberIds: ReadonlySet<string>;
}

export interface SeasonNode extends LevelScores {
  seasonNumber: number;
  title: string;
  /** The season's own work, once someone has scored the season itself. */
  review?: DetailedReviewListItem;
  episodes: EpisodeNode[];
  /** Episodes TMDB lists for this season — the coverage denominator. */
  episodeCount: number;
  scoredCount: number;
}

export interface ShowNode extends LevelScores {
  /** The show's own work, which a show score is written to. */
  workId: string;
  review: DetailedReviewListItem;
  showId: string;
  /** The show's own metadata, whose series fields a season or episode not yet
   * on the reviews list borrows. */
  data: TvDataSummary;
  title: string;
  imageUrl?: string;
  metaLine?: string;
  seasons: SeasonNode[];
  episodeCount: number;
  scoredCount: number;
  /** Most recent score anywhere in the show, which is how shows are ordered:
   * a club working through a series week by week would otherwise sit frozen
   * at the date it added the show. */
  lastScoredAt?: string;
  /** The date the show's card carries: when its latest season or episode
   * joined the reviews list, or the show itself before any has. */
  reviewedDate: string;
}

/**
 * A level's scores. A member's score is the one they set at this level, and
 * only when they have not set one is it the mean of their own scores one level
 * down — a score set on a season never reaches its episodes, and an episode
 * score never overwrites the season's. The club's number is the mean of those
 * member scores: averaging every review row instead would let a member who
 * scored only the two episodes they loved outweigh one who scored all nine.
 */
export function levelScores(own: ReviewScores, below: ReviewScores[]): LevelScores {
  const belowByMember = new Map<string, number[]>();
  for (const scores of below) {
    for (const [memberId, review] of Object.entries(scores)) {
      if (memberId === "average") continue;
      belowByMember.set(memberId, [...(belowByMember.get(memberId) ?? []), review.score]);
    }
  }

  const createdDate = new Date().toISOString();
  const scores: ReviewScores = {};
  const averagedMemberIds = new Set<string>();
  for (const [memberId, review] of Object.entries(own)) {
    if (memberId !== "average") scores[memberId] = review;
  }
  for (const [memberId, memberScores] of belowByMember) {
    if (isDefined(scores[memberId])) continue;
    scores[memberId] = { id: memberId, created_date: createdDate, score: mean(memberScores) };
    averagedMemberIds.add(memberId);
  }

  const memberScores = Object.values(scores).map((review) => review.score);
  if (memberScores.length === 0) return { scores: {}, averagedMemberIds };
  return {
    scores: {
      ...scores,
      average: { id: "average", created_date: createdDate, score: mean(memberScores) },
    },
    averagedMemberIds,
  };
}

function mean(values: number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function isScored(review: DetailedReviewListItem): boolean {
  return Object.keys(review.scores).length > 0;
}

/**
 * Group a flat reviews list into shows, seasons and episodes. The hierarchy
 * comes from each work's own address, so a season needs no work of its own
 * until someone scores it: its row is built from the show's cached season
 * list and whichever of its episodes are on the list.
 *
 * Works whose TV metadata has not cached yet are dropped rather than rendered
 * as an unplaceable row — the scheduled refresh fills them in.
 */
export function buildShowTree(reviews: DetailedReviewListItem[]): ShowNode[] {
  const shows = new Map<string, DetailedReviewListItem>();
  const seasonsByShow = new Map<string, Map<number, DetailedReviewListItem>>();
  const episodesByShow = new Map<string, EpisodeNode[]>();

  for (const review of reviews) {
    const tv = asTv(review.externalData);
    if (tv === undefined) continue;

    if (tv.level === "show") {
      shows.set(tv.showId, review);
    } else if (tv.level === "season" && tv.seasonNumber !== undefined) {
      const seasons = seasonsByShow.get(tv.showId) ?? new Map<number, DetailedReviewListItem>();
      seasons.set(tv.seasonNumber, review);
      seasonsByShow.set(tv.showId, seasons);
    } else if (tv.level === "episode" && tv.episodeNumber !== undefined) {
      const episodes = episodesByShow.get(tv.showId) ?? [];
      episodes.push({
        workId: review.id,
        episodeNumber: tv.episodeNumber,
        title: tv.title,
        airDate: tv.airDate,
        review,
        scored: isScored(review),
      });
      episodesByShow.set(tv.showId, episodes);
    }
  }

  const nodes: ShowNode[] = [];
  for (const [showId, showReview] of shows) {
    const tv = asTv(showReview.externalData);
    if (tv === undefined) continue;

    const seasonReviews = seasonsByShow.get(showId) ?? new Map<number, DetailedReviewListItem>();
    const seasons = buildSeasons(tv.seasons ?? [], seasonReviews, episodesByShow.get(showId) ?? []);
    const allEpisodes = seasons.flatMap((season) => season.episodes);
    const reviewsUnder = [
      ...seasonReviews.values(),
      ...allEpisodes.map((episode) => episode.review),
    ];

    nodes.push({
      ...levelScores(
        showReview.scores,
        seasons.map((season) => season.scores),
      ),
      workId: showReview.id,
      review: showReview,
      showId,
      data: tv,
      title: tv.showTitle,
      imageUrl: showReview.imageUrl,
      metaLine: showMetaLine(tv.numberOfSeasons, tv.numberOfEpisodes),
      seasons,
      episodeCount:
        tv.numberOfEpisodes ?? seasons.reduce((total, season) => total + season.episodeCount, 0),
      scoredCount: allEpisodes.filter((episode) => episode.scored).length,
      lastScoredAt: latestScoreDate([showReview, ...reviewsUnder]),
      reviewedDate: reviewsUnder
        .map((review) => review.createdDate)
        .reduce((a, b) => (a > b ? a : b), showReview.createdDate),
    });
  }

  return nodes.sort((a, b) => (b.lastScoredAt ?? "").localeCompare(a.lastScoredAt ?? ""));
}

/**
 * Season rows come from the show's TMDB season list, so every season is
 * browsable the moment a club adds a show — including the ones it has not
 * reached yet. A season TMDB does not list (specials a club scored
 * deliberately) still gets a row when it has a score, so none is ever hidden.
 */
function buildSeasons(
  seasonSummaries: TvSeasonSummary[],
  seasonReviews: Map<number, DetailedReviewListItem>,
  episodes: EpisodeNode[],
): SeasonNode[] {
  const bySeason = new Map<number, EpisodeNode[]>();
  for (const episode of episodes) {
    const seasonNumber = asTv(episode.review.externalData)?.seasonNumber;
    if (seasonNumber === undefined) continue;
    bySeason.set(seasonNumber, [...(bySeason.get(seasonNumber) ?? []), episode]);
  }

  const summaries = new Map(
    seasonSummaries.map((summary) => [summary.seasonNumber, summary] as const),
  );
  for (const seasonNumber of new Set([...bySeason.keys(), ...seasonReviews.keys()])) {
    if (summaries.has(seasonNumber)) continue;
    summaries.set(seasonNumber, {
      seasonNumber,
      name: seasonReviews.get(seasonNumber)?.title ?? `Season ${seasonNumber}`,
      episodeCount: bySeason.get(seasonNumber)?.length ?? 0,
    });
  }

  return [...summaries.values()]
    .sort((a, b) => a.seasonNumber - b.seasonNumber)
    .map((summary) => {
      const seasonEpisodes = (bySeason.get(summary.seasonNumber) ?? []).sort(
        (a, b) => a.episodeNumber - b.episodeNumber,
      );
      const review = seasonReviews.get(summary.seasonNumber);
      return {
        ...levelScores(
          review?.scores ?? {},
          seasonEpisodes.map((episode) => episode.review.scores),
        ),
        seasonNumber: summary.seasonNumber,
        title: summary.name,
        review,
        episodes: seasonEpisodes,
        episodeCount: Math.max(summary.episodeCount, seasonEpisodes.length),
        scoredCount: seasonEpisodes.filter((episode) => episode.scored).length,
      };
    });
}

/** The season a member is most likely picking up: the one holding the club's
 * latest review, or the first season before anything has been scored. */
export function currentSeasonNumber(show: ShowNode): number | undefined {
  let latest: { date: string; seasonNumber: number } | undefined;
  for (const season of show.seasons) {
    const reviews = [season.review, ...season.episodes.map((episode) => episode.review)];
    for (const review of reviews.filter(isDefined)) {
      if (latest === undefined || review.createdDate > latest.date) {
        latest = { date: review.createdDate, seasonNumber: season.seasonNumber };
      }
    }
  }
  return latest?.seasonNumber ?? show.seasons[0]?.seasonNumber;
}

/** Names a show, or one of its seasons, in the set of rows a reader has open. */
export const expansionKey = (showId: string, seasonNumber?: number) =>
  isDefined(seasonNumber) ? `season:${showId}:${seasonNumber}` : `show:${showId}`;

export const formatRollup = (scores: ReviewScores) =>
  isDefined(scores.average) ? scores.average.score.toFixed(1) : "—";

export const rollupLabel = (scores: ReviewScores) =>
  isDefined(scores.average) ? `average ${formatRollup(scores)}` : "no scores yet";

export const coverageLabel = (scored: number, total: number) => `${scored}/${total} episodes`;

/** Where the reader's own score at a season or show comes from, in a line. */
export function ownScoreNote(level: LevelScores, userId: string | undefined, below: string) {
  const own = isDefined(userId) ? level.scores[userId] : undefined;
  if (!isDefined(own) || !isDefined(userId)) return "You haven't scored it yet";
  const value = own.score.toFixed(1);
  return level.averagedMemberIds.has(userId)
    ? `Yours is averaged from your ${below}: ${value}`
    : `You scored it ${Math.round(own.score * 100) / 100}`;
}

function latestScoreDate(reviews: DetailedReviewListItem[]): string | undefined {
  const dates = reviews
    .flatMap((review) =>
      Object.entries(review.scores)
        .filter(([memberId]) => memberId !== "average")
        .map(([, score]) => score.created_date),
    )
    .filter(isDefined);
  return dates.length === 0 ? undefined : dates.reduce((a, b) => (a > b ? a : b));
}

function showMetaLine(
  seasons: number | undefined,
  episodes: number | undefined,
): string | undefined {
  const parts: string[] = [];
  if (isDefined(seasons) && seasons > 0) {
    parts.push(seasons === 1 ? "1 season" : `${seasons} seasons`);
  }
  if (isDefined(episodes) && episodes > 0) {
    parts.push(episodes === 1 ? "1 episode" : `${episodes} episodes`);
  }
  return parts.length > 0 ? parts.join(" · ") : undefined;
}
