import { isDefined } from "../../../lib/checks/checks.js";
import { DetailedReviewListItem, ReviewScores } from "../../../lib/types/lists";
import { TvSeasonSummary } from "../../../lib/types/tv";
import { asTv } from "@/common/workDisplay";

/**
 * One episode on the reviews list. A TV club only ever scores episodes, so an
 * episode node is the only node that carries a real review.
 */
export interface EpisodeNode {
  workId: string;
  episodeNumber: number;
  title: string;
  airDate?: string;
  review: DetailedReviewListItem;
  scored: boolean;
}

export interface SeasonNode {
  seasonNumber: number;
  title: string;
  episodes: EpisodeNode[];
  /** Episodes TMDB lists for this season — the coverage denominator. */
  episodeCount: number;
  scoredCount: number;
  scores: ReviewScores;
}

export interface ShowNode {
  /** The show's own work — what a score gesture on the show is aimed at. */
  workId: string;
  showId: string;
  title: string;
  imageUrl?: string;
  metaLine?: string;
  seasons: SeasonNode[];
  episodeCount: number;
  scoredCount: number;
  scores: ReviewScores;
  /** Most recent review under the show, which is how shows are ordered: a
   * club working through a series week by week would otherwise sit frozen at
   * the date it added the show. */
  lastScoredAt?: string;
}

/**
 * Roll a level up from the one below it, per member first: a member's score
 * for a season is the mean of their own episode scores, and the club's is the
 * mean of those member scores. Averaging every review row instead would let a
 * member who scored only the two episodes they loved outweigh one who scored
 * all nine.
 */
export function rollUpScores(sources: ReviewScores[]): ReviewScores {
  const byMember = new Map<string, number[]>();
  for (const scores of sources) {
    for (const [memberId, review] of Object.entries(scores)) {
      if (memberId === "average") continue;
      const memberScores = byMember.get(memberId) ?? [];
      memberScores.push(review.score);
      byMember.set(memberId, memberScores);
    }
  }
  if (byMember.size === 0) return {};

  const createdDate = new Date().toISOString();
  const rolled: ReviewScores = {};
  for (const [memberId, scores] of byMember) {
    rolled[memberId] = { id: memberId, created_date: createdDate, score: mean(scores) };
  }
  return {
    ...rolled,
    average: {
      id: "average",
      created_date: createdDate,
      score: mean(Object.values(rolled).map((review) => review.score)),
    },
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
 * comes from each work's own address, so a season needs no work of its own:
 * its row is built from the show's cached season list and whichever of its
 * episodes have been scored.
 *
 * Works whose TV metadata has not cached yet are dropped rather than rendered
 * as an unplaceable row — the scheduled refresh fills them in.
 */
export function buildShowTree(reviews: DetailedReviewListItem[]): ShowNode[] {
  const shows = new Map<string, DetailedReviewListItem>();
  const episodesByShow = new Map<string, EpisodeNode[]>();

  for (const review of reviews) {
    const tv = asTv(review.externalData);
    if (tv === undefined) continue;

    if (tv.level === "show") {
      shows.set(tv.showId, review);
      continue;
    }
    if (tv.level !== "episode" || tv.episodeNumber === undefined || tv.seasonNumber === undefined) {
      continue;
    }

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

  const nodes: ShowNode[] = [];
  for (const [showId, showReview] of shows) {
    const tv = asTv(showReview.externalData);
    if (tv === undefined) continue;

    const episodes = episodesByShow.get(showId) ?? [];
    const seasons = buildSeasons(tv.seasons ?? [], episodes);
    const allEpisodes = seasons.flatMap((season) => season.episodes);

    nodes.push({
      workId: showReview.id,
      showId,
      title: tv.showTitle,
      imageUrl: showReview.imageUrl,
      metaLine: showMetaLine(tv.numberOfSeasons, tv.numberOfEpisodes),
      seasons,
      episodeCount:
        tv.numberOfEpisodes ?? seasons.reduce((total, season) => total + season.episodeCount, 0),
      scoredCount: allEpisodes.filter((episode) => episode.scored).length,
      scores: rollUpScores(seasons.map((season) => season.scores)),
      lastScoredAt: latestScoreDate(allEpisodes),
    });
  }

  return nodes.sort((a, b) => (b.lastScoredAt ?? "").localeCompare(a.lastScoredAt ?? ""));
}

/**
 * Season rows come from the show's TMDB season list, so every season is
 * browsable the moment a club adds a show — including the ones it has not
 * reached yet. Episodes the club has scored are slotted into their season; a
 * season TMDB does not list (a special a club scored deliberately) still gets
 * a row so its scores are never hidden.
 */
function buildSeasons(seasonSummaries: TvSeasonSummary[], episodes: EpisodeNode[]): SeasonNode[] {
  const bySeason = new Map<number, EpisodeNode[]>();
  for (const episode of episodes) {
    const seasonNumber = asTv(episode.review.externalData)?.seasonNumber;
    if (seasonNumber === undefined) continue;
    const group = bySeason.get(seasonNumber) ?? [];
    group.push(episode);
    bySeason.set(seasonNumber, group);
  }

  const summaries = new Map(
    seasonSummaries.map((summary) => [summary.seasonNumber, summary] as const),
  );
  for (const seasonNumber of bySeason.keys()) {
    if (summaries.has(seasonNumber)) continue;
    summaries.set(seasonNumber, {
      seasonNumber,
      name: `Season ${seasonNumber}`,
      episodeCount: bySeason.get(seasonNumber)?.length ?? 0,
    });
  }

  return [...summaries.values()]
    .sort((a, b) => a.seasonNumber - b.seasonNumber)
    .map((summary) => {
      const seasonEpisodes = (bySeason.get(summary.seasonNumber) ?? []).sort(
        (a, b) => a.episodeNumber - b.episodeNumber,
      );
      return {
        seasonNumber: summary.seasonNumber,
        title: summary.name,
        episodes: seasonEpisodes,
        episodeCount: Math.max(summary.episodeCount, seasonEpisodes.length),
        scoredCount: seasonEpisodes.filter((episode) => episode.scored).length,
        scores: rollUpScores(
          seasonEpisodes
            .filter((episode) => episode.scored)
            .map((episode) => episode.review.scores),
        ),
      };
    });
}

function latestScoreDate(episodes: EpisodeNode[]): string | undefined {
  const dates = episodes
    .flatMap((episode) =>
      Object.entries(episode.review.scores)
        .filter(([memberId]) => memberId !== "average")
        .map(([, review]) => review.created_date),
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
