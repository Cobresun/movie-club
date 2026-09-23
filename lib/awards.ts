import { z } from "zod";

import { AwardsData, AwardsStep, BaseAward, BaseAwardNomination } from "./types/awards";

export const NOMINATIONS_PER_AWARD = 2;
export const AWARD_TITLE_MAX_LENGTH = 60;
export const AWARDS_YEAR_MIN = 1900;
export const AWARDS_YEAR_MAX = 2100;

export const isSameCategoryTitle = (a: string, b: string) =>
  a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();

export const awardTitleSchema = z
  .string()
  .trim()
  .min(1, "Give the category a name")
  .max(AWARD_TITLE_MAX_LENGTH, `Keep it under ${AWARD_TITLE_MAX_LENGTH} characters`);

export const awardsYearSchema = z
  .number()
  .int("Enter a whole year")
  .min(AWARDS_YEAR_MIN, `Pick a year from ${AWARDS_YEAR_MIN}`)
  .max(AWARDS_YEAR_MAX, `Pick a year up to ${AWARDS_YEAR_MAX}`);

export const createAwardsYearSchema = z.object({
  year: awardsYearSchema,
  categories: z
    .array(awardTitleSchema)
    .refine(
      (titles) =>
        titles.every((title, i) => titles.findIndex((t) => isSameCategoryTitle(t, title)) === i),
      "Category names must be unique",
    ),
});

/** A category with a single nominee has nothing to rank: it wins by default. */
export const needsRanking = (award: BaseAward) => award.nominations.length > 1;

export const hasRankedAward = (award: BaseAward, voterId: string) =>
  award.nominations.every((nomination) => nomination.ranking[voterId] !== undefined);

export const hasFinishedVoting = (awards: BaseAward[], voterId: string) =>
  awards.filter(needsRanking).every((award) => hasRankedAward(award, voterId));

/**
 * A member has finished nominating once they have a nominee in every category.
 * Backing a movie someone else already nominated counts, so a member is never
 * stuck on a category they have no fresh pick for.
 */
export const hasFinishedNominating = (awards: BaseAward[], userId: string) =>
  awards.every((award) =>
    award.nominations.some((nomination) => nomination.nominatedBy.includes(userId)),
  );

/**
 * The members who still have their part of the current phase to do. Only
 * nominations and voting ask something of every member; the other phases are
 * run by the club as a whole.
 */
export function membersYetToFinish(data: AwardsData, memberIds: string[]): string[] {
  switch (data.step) {
    case AwardsStep.Nominations:
      return memberIds.filter((id) => !hasFinishedNominating(data.awards, id));
    case AwardsStep.Ratings:
      return memberIds.filter((id) => !hasFinishedVoting(data.awards, id));
    case AwardsStep.CategorySelect:
    case AwardsStep.Presentation:
    case AwardsStep.Completed:
      return [];
  }
}

/** What members are doing during the phases that ask something of each of them. */
export const PHASE_WORK: Partial<Record<AwardsStep, string>> = {
  [AwardsStep.Nominations]: "nominating",
  [AwardsStep.Ratings]: "voting",
};

/**
 * Why the year cannot move to `target`, or `undefined` when it can. Steps move
 * one at a time. The club moves forward together: nobody can close a phase
 * while a member still has their part of it to do. Moving back is always
 * allowed, so a phase can be reopened for someone who needs to change theirs.
 */
export function stepChangeError(
  data: AwardsData,
  target: AwardsStep,
  memberIds: string[],
): string | undefined {
  if (Math.abs(target - data.step) !== 1) {
    return "Awards move one step at a time";
  }
  if (target < data.step) return undefined;

  if (data.step === AwardsStep.CategorySelect && data.awards.length === 0) {
    return "Add at least one category before opening nominations";
  }
  const waiting = membersYetToFinish(data, memberIds).length;
  if (waiting > 0) {
    return `Everyone has to finish ${PHASE_WORK[data.step] ?? "this step"} first (${waiting} still to go)`;
  }
  return undefined;
}

export interface ScoredNomination<T extends BaseAwardNomination> {
  nomination: T;
  /** Sum of every voter's rank for this nominee; lower is better. */
  score: number;
  winner: boolean;
}

/**
 * Ranks a category's nominees by total rank across everyone who voted in it.
 *
 * A voter who ranked some nominees but not others (a nominee added after they
 * voted) counts the missing ones as last place, so a late nominee cannot win on
 * an empty column. Ties share the win.
 */
export function scoreAward<T extends BaseAwardNomination>(
  nominations: T[],
): { voters: string[]; results: ScoredNomination<T>[] } {
  const voters = [...new Set(nominations.flatMap((nomination) => Object.keys(nomination.ranking)))];
  const lastPlace = nominations.length;

  const scored = nominations
    .map((nomination) => ({
      nomination,
      score: voters.reduce((sum, voter) => sum + (nomination.ranking[voter] ?? lastPlace), 0),
    }))
    .sort((a, b) => a.score - b.score);

  const best = scored[0]?.score;
  const decided = voters.length > 0 || nominations.length === 1;

  return {
    voters,
    results: scored.map((entry) => ({ ...entry, winner: decided && entry.score === best })),
  };
}
