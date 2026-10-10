import { WorkType } from "../../../lib/types/generated/db";
import { SimilarWork, WorkRecommendation } from "../../../lib/types/recommendations";

/**
 * Club recommendations, in two steps.
 *
 * 1. {@link selectSeeds} turns every score given in the club's reviews into a
 *    per-work *affinity*: how far above or below their own habits the members
 *    scored it. Likes drawn from the strongest, and the strongest dislikes,
 *    become seeds.
 * 2. The external source lists works similar to each seed, and
 *    {@link rankRecommendations} sums, per candidate, each seed's affinity
 *    discounted by how far down that seed's list the candidate sits. A film
 *    several favourites point at rises; one that mostly resembles a flop sinks.
 *    Dislikes never add a candidate — they only push down what the likes found.
 */

/** One score a member gave a work in the club's reviews. */
export interface MemberScore {
  userId: string;
  type: WorkType;
  externalId: string;
  title: string;
  /** 0–10. */
  score: number;
}

export interface Seed {
  externalId: string;
  type: WorkType;
  title: string;
  /** Above 0 when the members liked it relative to their habits, below when they didn't. */
  affinity: number;
}

export interface SeedSimilarWorks {
  seed: Seed;
  works: SimilarWork[];
}

/** Midpoint of the 0–10 scale; a member with few scores is assumed to centre here. */
const PRIOR_SCORE = 5;
/** Pseudo-scores at {@link PRIOR_SCORE} blended into every member's mean. */
const PRIOR_WEIGHT = 3;
/**
 * Floor on a member's score spread, so someone who gives everything a 7 does
 * not turn a single 8 into a rave.
 */
const MIN_SPREAD = 1.5;
/** Pseudo-weight of "no opinion" in each work's affinity, so agreement outweighs one voice. */
const AFFINITY_SHRINKAGE = 1;
const MIN_SEED_AFFINITY = 0.25;
const LIKED_SEEDS = 8;
/**
 * The strongest likes the {@link LIKED_SEEDS} are drawn from. Drawing rather
 * than always taking the top few lets a club with many reviews see different
 * recommendations from one visit to the next.
 */
const LIKED_SEED_POOL = 20;
const DISLIKED_SEEDS = 3;
/** List position at which a candidate's pull from a seed has halved. */
const RANK_HALF_WEIGHT = 5;
const MAX_RECOMMENDATIONS = 24;
const MAX_REASONS = 2;

interface Baseline {
  center: number;
  spread: number;
}

function memberBaselines(scores: readonly MemberScore[]): Map<string, Baseline> {
  const byMember = new Map<string, number[]>();
  for (const { userId, score } of scores) {
    byMember.set(userId, [...(byMember.get(userId) ?? []), score]);
  }
  return new Map(
    Array.from(byMember, ([userId, values]) => {
      const total = values.reduce((sum, value) => sum + value, 0);
      const center = (total + PRIOR_SCORE * PRIOR_WEIGHT) / (values.length + PRIOR_WEIGHT);
      const variance =
        values.reduce((sum, value) => sum + (value - center) ** 2, 0) / values.length;
      return [userId, { center, spread: Math.max(MIN_SPREAD, Math.sqrt(variance)) }];
    }),
  );
}

/**
 * The works whose scores say most about the club's taste, relative to each
 * member's own scoring habits: likes drawn from its strongest, and its
 * strongest dislikes.
 */
export function selectSeeds(
  scores: readonly MemberScore[],
  random: () => number = Math.random,
): Seed[] {
  const baselines = memberBaselines(scores);

  const works = new Map<
    string,
    { type: WorkType; title: string; deviations: number; count: number }
  >();
  for (const score of scores) {
    const baseline = baselines.get(score.userId);
    if (baseline === undefined) continue;
    const work = works.get(score.externalId) ?? {
      type: score.type,
      title: score.title,
      deviations: 0,
      count: 0,
    };
    work.deviations += (score.score - baseline.center) / baseline.spread;
    work.count += 1;
    works.set(score.externalId, work);
  }

  const seeds: Seed[] = Array.from(works, ([externalId, work]) => ({
    externalId,
    type: work.type,
    title: work.title,
    affinity: work.deviations / (work.count + AFFINITY_SHRINKAGE),
  }));
  const likedPool = seeds
    .filter((seed) => seed.affinity >= MIN_SEED_AFFINITY)
    .sort((a, b) => b.affinity - a.affinity)
    .slice(0, LIKED_SEED_POOL);
  const disliked = seeds
    .filter((seed) => seed.affinity <= -MIN_SEED_AFFINITY)
    .sort((a, b) => a.affinity - b.affinity)
    .slice(0, DISLIKED_SEEDS);
  return [...drawWeighted(likedPool, LIKED_SEEDS, random), ...disliked];
}

/**
 * `count` of `seeds` drawn without replacement, each with odds in proportion
 * to its affinity (Efraimidis–Spirakis), so the strongest likes turn up most
 * often without crowding out the rest.
 */
function drawWeighted(seeds: readonly Seed[], count: number, random: () => number): Seed[] {
  return seeds
    .map((seed) => ({ seed, key: random() ** (1 / seed.affinity) }))
    .sort((a, b) => b.key - a.key)
    .slice(0, count)
    .map(({ seed }) => seed);
}

/**
 * Rank every work similar to a seed, best first. Only candidates the seeds
 * pull toward on balance are returned.
 */
export function rankRecommendations(
  similarBySeed: readonly SeedSimilarWorks[],
): WorkRecommendation[] {
  const candidates = new Map<
    string,
    { work: SimilarWork; score: number; reasons: { title: string; pull: number }[] }
  >();
  for (const { seed, works } of similarBySeed) {
    works.forEach((work, rank) => {
      const pull = seed.affinity / (1 + rank / RANK_HALF_WEIGHT);
      const candidate = candidates.get(work.externalId) ?? { work, score: 0, reasons: [] };
      candidate.score += pull;
      if (pull > 0) candidate.reasons.push({ title: seed.title, pull });
      candidates.set(work.externalId, candidate);
    });
  }

  return [...candidates.values()]
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RECOMMENDATIONS)
    .map(({ work, reasons }) => ({
      ...work,
      similarTo: reasons
        .sort((a, b) => b.pull - a.pull)
        .slice(0, MAX_REASONS)
        .map((reason) => reason.title),
    }));
}
