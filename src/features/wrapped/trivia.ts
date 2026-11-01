import { isDefined } from "../../../lib/checks/checks.js";
import { type Member } from "../../../lib/types/club";
import { computeMemberPairSimilarities } from "../statistics/statsComputers";
import { type WorkStatsData } from "../statistics/types";
import { computeHotTakes, computePicks } from "./wrapped";
import { firstName } from "@/common/memberName";

interface Person {
  id: string;
  name: string;
  image?: string;
}

export interface TriviaOption {
  id: string;
  label: string;
  imageUrl?: string;
  people?: Person[];
}

export interface Trivia {
  question: string;
  options: TriviaOption[];
  answerId: string;
  /** What actually happened, shown once the member has answered. */
  reveal: string;
}

const MAX_OPTIONS = 4;
const MIN_OPTIONS = 2;
/**
 * Averages and gaps are unrounded floats, so two equal-looking results reached
 * by different sums can differ in the last bit. Closer than this is a tie.
 */
const TIE_EPSILON = 1e-9;

export function countLabel(count: number, singular: string, plural = `${singular}s`): string {
  return `${count.toLocaleString("en-US")} ${count === 1 ? singular : plural}`;
}

/**
 * A string hash feeding a small PRNG, so a year's options come out in the same
 * order on every visit and every device, yet the answer is not always first.
 */
function seededRandom(seed: string): () => number {
  let state = 2166136261;
  for (let index = 0; index < seed.length; index++) {
    state = Math.imul(state ^ seed.charCodeAt(index), 16777619);
  }
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const swap = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]];
  }
  return shuffled;
}

/** The answer plus up to three distractors, in a seeded order. */
function multipleChoice(
  seed: string,
  answer: TriviaOption,
  distractors: TriviaOption[],
  question: string,
  reveal: string,
): Trivia | undefined {
  const random = seededRandom(seed);
  const picked = shuffle(distractors, random).slice(0, MAX_OPTIONS - 1);
  if (picked.length + 1 < MIN_OPTIONS) return undefined;
  return {
    question,
    options: shuffle([answer, ...picked], random),
    answerId: answer.id,
    reveal,
  };
}

/**
 * Wrong answers scaled from the right one. Which set is used varies by seed so
 * the answer is not always the smallest or largest of the sorted options.
 */
const NUMBER_SPREADS = [
  [1.4, 1.8, 2.4],
  [0.6, 1.4, 1.9],
  [0.5, 0.75, 1.5],
  [0.35, 0.55, 0.75],
];

export function numberTrivia(
  seed: string,
  value: number,
  /** Singular; options read "1 hour", "2 hours". */
  unit: string,
  question: string,
  reveal: string,
): Trivia | undefined {
  if (value <= 0) return undefined;
  const random = seededRandom(seed);
  const spread = NUMBER_SPREADS[Math.floor(random() * NUMBER_SPREADS.length)];
  const used = new Set([value]);
  for (const factor of spread) {
    // Small values round onto each other; step away from the answer until free.
    let candidate = Math.max(1, Math.round(value * factor));
    let step = factor < 1 ? -1 : 1;
    while (used.has(candidate)) {
      // Stepping down from a tiny total runs out of counts above zero, so turn
      // around and look above the answer instead.
      if (candidate + step <= 0) step = 1;
      candidate += step;
    }
    used.add(candidate);
  }
  const values = [...used].sort((a, b) => a - b);
  return {
    question,
    options: values.map((candidate) => ({
      id: String(candidate),
      label: countLabel(candidate, unit),
    })),
    answerId: String(value),
    reveal,
  };
}

export function topPickTrivia(
  seed: string,
  workData: WorkStatsData[],
  noun: string,
): Trivia | undefined {
  const best = computePicks(workData).top.at(0);
  if (!isDefined(best)) return undefined;
  const asOption = (work: WorkStatsData): TriviaOption => ({
    id: work.id,
    label: work.title,
    imageUrl: work.imageUrl,
  });
  return multipleChoice(
    seed,
    asOption(best),
    // A work tied with the best would be a right answer marked wrong.
    workData.filter((work) => best.average - work.average > TIE_EPSILON).map(asOption),
    `Which ${noun} did the club rate highest?`,
    `${best.title}, averaging ${best.average.toFixed(1)}.`,
  );
}

function memberOption(member: Person): TriviaOption {
  return { id: member.id, label: firstName(member.name), people: [member] };
}

export function hotTakeTrivia(
  seed: string,
  workData: WorkStatsData[],
  members: Member[],
): Trivia | undefined {
  const [hottest, ...rest] = computeHotTakes(workData, members);
  if (!isDefined(hottest)) return undefined;
  const tied = new Set(
    rest
      .filter((take) => Math.abs(Math.abs(take.gap) - Math.abs(hottest.gap)) < TIE_EPSILON)
      .map((take) => take.member.id),
  );
  const scorers = members.filter((member) =>
    workData.some((work) => isDefined(work.userScores[member.id])),
  );
  const name = firstName(hottest.member.name);
  return multipleChoice(
    seed,
    memberOption(hottest.member),
    scorers
      .filter((member) => member.id !== hottest.member.id && !tied.has(member.id))
      .map(memberOption),
    "Who had the club's hottest take?",
    `${name} ${hottest.gap > 0 ? "loved" : "panned"} ${hottest.title}, giving it ${hottest.memberScore} against everyone else's ${hottest.othersAverage.toFixed(1)}.`,
  );
}

export function tasteTwinsTrivia(
  seed: string,
  workData: WorkStatsData[],
  members: Member[],
): Trivia | undefined {
  const pairs = computeMemberPairSimilarities(workData, members);
  const twins = pairs.reduce<(typeof pairs)[number] | undefined>(
    (best, pair) =>
      !isDefined(best) || pair.similarityPercent > best.similarityPercent ? pair : best,
    undefined,
  );
  if (!isDefined(twins)) return undefined;

  const pairOption = (pair: { memberA: Person; memberB: Person }): TriviaOption => ({
    id: `${pair.memberA.id}:${pair.memberB.id}`,
    label: `${firstName(pair.memberA.name)} & ${firstName(pair.memberB.name)}`,
    people: [pair.memberA, pair.memberB],
  });

  // Pairs that tie the twins can't be wrong answers.
  const others = pairs
    .filter((pair) => pair.similarityPercent < twins.similarityPercent)
    .map(pairOption);

  return multipleChoice(
    seed,
    pairOption(twins),
    others,
    "Which two members scored most alike?",
    `${pairOption(twins).label}, ${Math.round(twins.similarityPercent)}% in sync.`,
  );
}
