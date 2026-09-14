import { hasValue } from "../../../lib/checks/checks.js";
import { ReviewScores } from "../../../lib/types/lists";
import { episodeCode, TMDBTvEpisodeData } from "../../../lib/types/tv";
import { EpisodeNode } from "./reviewTree";
import { tmdbStillUrl } from "@/common/workDisplay";

/** One card in a season's episode gallery. */
export interface EpisodeCard {
  episodeNumber: number;
  code: string;
  title: string;
  stillUrl?: string;
  /** The episode's work on the reviews list — absent until the club scores it. */
  node?: EpisodeNode;
  /** Whether the episode has aired, so there is something to score. */
  aired: boolean;
}

/**
 * Every episode of a season as a card. TMDB decides which episodes exist; the
 * reviews list decides which of them the club has scored. An episode on the
 * list that TMDB no longer lists still gets its card, so a score is never
 * hidden — the same rule `buildShowTree` applies to seasons.
 *
 * Until the season's TMDB listing arrives (or if it cannot be fetched), the
 * cards are the scored episodes alone.
 */
export function buildEpisodeCards(
  seasonNumber: number,
  tmdbEpisodes: TMDBTvEpisodeData[] | undefined,
  listed: EpisodeNode[],
  today: string,
): EpisodeCard[] {
  const listedByNumber = new Map(listed.map((node) => [node.episodeNumber, node] as const));
  const cards = new Map<number, EpisodeCard>();

  for (const episode of tmdbEpisodes ?? []) {
    const node = listedByNumber.get(episode.episode_number);
    cards.set(episode.episode_number, {
      episodeNumber: episode.episode_number,
      code: episodeCode(seasonNumber, episode.episode_number),
      title: node?.title ?? episode.name ?? episodeCode(seasonNumber, episode.episode_number),
      stillUrl:
        node?.review.imageUrl ??
        (hasValue(episode.still_path) ? tmdbStillUrl(episode.still_path) : undefined),
      node,
      aired: node !== undefined || (hasValue(episode.air_date) && episode.air_date <= today),
    });
  }

  for (const node of listed) {
    if (cards.has(node.episodeNumber)) continue;
    cards.set(node.episodeNumber, {
      episodeNumber: node.episodeNumber,
      code: episodeCode(seasonNumber, node.episodeNumber),
      title: node.title,
      stillUrl: node.review.imageUrl,
      node,
      aired: true,
    });
  }

  return [...cards.values()].sort((a, b) => a.episodeNumber - b.episodeNumber);
}

/**
 * A score map with one member's score written in and the average recomputed,
 * mirroring the server's `buildReviewScores` — what a card shows while that
 * member's save is still in flight.
 */
export function withMemberScore(
  scores: ReviewScores,
  memberId: string,
  score: number,
): ReviewScores {
  const createdDate = new Date().toISOString();
  const members: ReviewScores = Object.fromEntries(
    Object.entries(scores).filter(([key]) => key !== "average"),
  );
  members[memberId] = { id: "pending", created_date: createdDate, score };
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
