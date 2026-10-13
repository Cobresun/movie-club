import { hasValue, isDefined } from "../../../lib/checks/checks.js";
import { DetailedReviewListItem, ReviewScores } from "../../../lib/types/lists";
import { formatTvAddress, TvDataSummary, TvSeasonSummary } from "../../../lib/types/tv";
import { asTv } from "@/common/workDisplay";
import { OPTIMISTIC_WORK_ID } from "@/service/useList";

/** One episode on the reviews list. */
export interface EpisodeNode {
  workId: string;
  episodeNumber: number;
  title: string;
  airDate?: string;
  review: DetailedReviewListItem;
  scored: boolean;
}

/** A show's scores, each member's either set on the show or averaged from
 * their seasons. */
export interface LevelScores {
  scores: ReviewScores;
  /** Members whose score here is averaged from the level below, not set. */
  averagedMemberIds: ReadonlySet<string>;
}

export interface SeasonNode {
  seasonNumber: number;
  title: string;
  /** Each member's average over the episodes they scored, and the club's mean
   * of those. A season is never scored on its own. */
  scores: ReviewScores;
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
  /** Most recent score anywhere in the show. */
  lastScoredAt?: string;
  /** The date the show's card carries: when its latest season or episode
   * joined the reviews list, or the show itself before any has. */
  reviewedDate: string;
}

/**
 * A level's scores. A member's score is the one they set at this level (only
 * a show can be scored on its own), and only when they have not set one is it
 * the mean of their own scores one level down — a show score never reaches
 * its seasons. The club's number is the mean of those member scores: averaging
 * every review row instead would let a member who scored only the two
 * episodes they loved outweigh one who scored all nine.
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
 * Pending shows ({@link isPendingShow}) are left out: they have no seasons
 * to build a row from, so the list draws them as placeholders instead.
 */
export function buildShowTree(reviews: DetailedReviewListItem[]): ShowNode[] {
  const shows = new Map<string, DetailedReviewListItem>();
  const episodesByShow = new Map<string, EpisodeNode[]>();

  for (const review of reviews) {
    const tv = asTv(review.externalData);
    if (tv === undefined || isPendingShow(review)) continue;

    if (tv.level === "show") {
      shows.set(tv.showId, review);
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

    const seasons = buildSeasons(tv.seasons ?? [], episodesByShow.get(showId) ?? []);
    const allEpisodes = seasons.flatMap((season) => season.episodes);
    const reviewsUnder = allEpisodes.map((episode) => episode.review);

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
      metaLine: showMetaLine(tv),
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

  return nodes.sort((a, b) => lastActivity(b).localeCompare(lastActivity(a)));
}

/**
 * How shows are ordered: by the latest thing that happened to each, a score
 * anywhere in it or the show being added. A club working through a series
 * week by week would otherwise sit frozen at the date it added the show, and
 * a show just added would sink below every show with a score.
 */
function lastActivity(show: ShowNode): string {
  const scored = show.lastScoredAt ?? "";
  return scored > show.review.createdDate ? scored : show.review.createdDate;
}

/** The show the club scored most recently, which a visit opens on. */
export function lastScoredShow(shows: ShowNode[]): ShowNode | undefined {
  return shows
    .filter((show) => isDefined(show.lastScoredAt))
    .reduce<ShowNode | undefined>(
      (latest, show) =>
        isDefined(latest) && (latest.lastScoredAt ?? "") >= (show.lastScoredAt ?? "")
          ? latest
          : show,
      undefined,
    );
}

/**
 * A show on its way onto the reviews list: the optimistic work an add puts
 * there before the server has it, or a show the server has but whose TMDB
 * details have not cached yet. Neither has the seasons a row is built from.
 */
export function isPendingShow(review: DetailedReviewListItem): boolean {
  return review.id === OPTIMISTIC_WORK_ID || !isDefined(asTv(review.externalData));
}

/**
 * Season rows come from the show's TMDB season list, so every season is
 * browsable the moment a club adds a show — including the ones it has not
 * reached yet. A season TMDB does not list (specials a club scored
 * deliberately) still gets a row when one of its episodes has a score, so
 * none is ever hidden.
 */
function buildSeasons(seasonSummaries: TvSeasonSummary[], episodes: EpisodeNode[]): SeasonNode[] {
  const bySeason = new Map<number, EpisodeNode[]>();
  for (const episode of episodes) {
    const seasonNumber = asTv(episode.review.externalData)?.seasonNumber;
    if (seasonNumber === undefined) continue;
    bySeason.set(seasonNumber, [...(bySeason.get(seasonNumber) ?? []), episode]);
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
        scores: levelScores(
          {},
          seasonEpisodes.map((episode) => episode.review.scores),
        ).scores,
        seasonNumber: summary.seasonNumber,
        title: summary.name,
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
    for (const review of season.episodes.map((episode) => episode.review)) {
      if (latest === undefined || review.createdDate > latest.date) {
        latest = { date: review.createdDate, seasonNumber: season.seasonNumber };
      }
    }
  }
  return latest?.seasonNumber ?? show.seasons[0]?.seasonNumber;
}

/** The id of a season's tab in its show's season list, unique on the page. */
export const seasonTabId = (showId: string, seasonNumber: number) =>
  `show-${showId}-season-${seasonNumber}`;

/** The id of the panel a season's tab controls. */
export const seasonPanelId = (showId: string, seasonNumber: number) =>
  `${seasonTabId(showId, seasonNumber)}-panel`;

export const formatRollup = (scores: ReviewScores) =>
  isDefined(scores.average) ? scores.average.score.toFixed(1) : "—";

export const rollupLabel = (scores: ReviewScores) =>
  isDefined(scores.average) ? `average ${formatRollup(scores)}` : "no scores yet";

export const coverageLabel = (scored: number, total: number) => `${scored}/${total} episodes`;

/** How much of the coverage bar is filled, as a whole percentage. */
export const coveragePercent = (scored: number, total: number) =>
  total === 0 ? 0 : Math.round((scored / total) * 100);

/** A season has no work of its own to reveal by, so it reveals by its address. */
export const seasonRevealKey = (showId: string, season: SeasonNode) =>
  formatTvAddress({ showId, seasonNumber: season.seasonNumber });

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

/** Year, network and season count. The episode count is left to the
 * coverage line beneath it, which already reads "x/19 episodes". */
function showMetaLine(tv: TvDataSummary): string | undefined {
  const parts: string[] = [];
  const year = tv.airDate?.slice(0, 4);
  if (hasValue(year)) parts.push(year);
  const network = tv.networks[0];
  if (hasValue(network)) parts.push(network);
  const seasons = tv.numberOfSeasons;
  if (isDefined(seasons) && seasons > 0) {
    parts.push(seasons === 1 ? "1 season" : `${seasons} seasons`);
  }
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

/**
 * Every work of each show `matched` touches. A show's rows and rollups are
 * built from all of its works, so a search hitting one episode title, or a
 * filter only episodes carry (season, runtime), keeps the whole show rather
 * than handing the tree an episode with no show to hang from.
 */
export function wholeShows(
  all: DetailedReviewListItem[],
  matched: DetailedReviewListItem[],
): DetailedReviewListItem[] {
  const showIds = new Set(
    matched.map((review) => asTv(review.externalData)?.showId).filter(isDefined),
  );
  const matchedIds = new Set(matched.map((review) => review.id));
  return all.filter((review) => {
    // A show still being added stays in view whatever the filters say: it is
    // what the reader just did.
    if (isPendingShow(review)) return review.id === OPTIMISTIC_WORK_ID || matchedIds.has(review.id);
    const showId = asTv(review.externalData)?.showId;
    return isDefined(showId) && showIds.has(showId);
  });
}
