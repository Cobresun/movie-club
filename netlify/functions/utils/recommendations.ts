import { SimilarWork, WorkRecommendation } from "../../../lib/types/recommendations";

/**
 * Club recommendations, in two steps.
 *
 * 1. {@link selectSeeds} turns every score given in the club's reviews into a
 *    per-work *affinity*: how far above or below their own habits the members
 *    scored it. The strongest likes and dislikes become seeds.
 * 2. The external source lists works similar to each seed, and
 *    {@link rankRecommendations} sums, per candidate, each seed's affinity
 *    discounted by how far down that seed's list the candidate sits. A film
 *    several favourites point at rises; one that mostly resembles a flop sinks.
 */

/** One score a member gave a work in the club's reviews. */
export interface MemberScore {
  userId: string;
  externalId: string;
  title: string;
  /** 0–10. */
  score: number;
}

export interface Seed {
  externalId: string;
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
 * The works whose scores say most about the club's taste: its strongest likes
 * and dislikes, relative to each member's own scoring habits.
 */
export function selectSeeds(scores: readonly MemberScore[]): Seed[] {
  const baselines = memberBaselines(scores);

  const works = new Map<string, { title: string; deviations: number; count: number }>();
  for (const score of scores) {
    const baseline = baselines.get(score.userId);
    if (baseline === undefined) continue;
    const work = works.get(score.externalId) ?? { title: score.title, deviations: 0, count: 0 };
    work.deviations += (score.score - baseline.center) / baseline.spread;
    work.count += 1;
    works.set(score.externalId, work);
  }

  const seeds: Seed[] = Array.from(works, ([externalId, work]) => ({
    externalId,
    title: work.title,
    affinity: work.deviations / (work.count + AFFINITY_SHRINKAGE),
  }));
  const liked = seeds
    .filter((seed) => seed.affinity >= MIN_SEED_AFFINITY)
    .sort((a, b) => b.affinity - a.affinity)
    .slice(0, LIKED_SEEDS);
  const disliked = seeds
    .filter((seed) => seed.affinity <= -MIN_SEED_AFFINITY)
    .sort((a, b) => a.affinity - b.affinity)
    .slice(0, DISLIKED_SEEDS);
  return [...liked, ...disliked];
}

/**
 * Rank every work similar to a seed, best first, leaving out `excluded` ids.
 * Only candidates the seeds pull toward on balance are returned.
 */
export function rankRecommendations(
  similarBySeed: readonly SeedSimilarWorks[],
  excluded: ReadonlySet<string>,
): WorkRecommendation[] {
  const candidates = new Map<
    string,
    { work: SimilarWork; score: number; reasons: { title: string; pull: number }[] }
  >();
  for (const { seed, works } of similarBySeed) {
    works.forEach((work, rank) => {
      if (excluded.has(work.externalId)) return;
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
