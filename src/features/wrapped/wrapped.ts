import { isDefined } from "../../../lib/checks/checks.js";
import type { Member } from "../../../lib/types/club";
import { computeTasteSimilarity } from "../statistics/statsComputers";
import type { WorkStatsData } from "../statistics/types";

/**
 * The calendar year a work belongs to in Wrapped: the UTC year it was added to
 * the club's reviews, the same grouping `computeHighestRatedByYear` uses.
 */
export function reviewYear(work: WorkStatsData): number | undefined {
  const date = new Date(work.createdDate);
  return isNaN(date.getTime()) ? undefined : date.getUTCFullYear();
}

/** Every year the club reviewed something in, newest first. */
export function wrappedYears(workData: WorkStatsData[]): number[] {
  const years = new Set(workData.map(reviewYear).filter(isDefined));
  return [...years].sort((a, b) => b - a);
}

export function worksInYear<T extends WorkStatsData>(workData: T[], year: number): T[] {
  return workData.filter((work) => reviewYear(work) === year);
}

/** Whether `year` is still under way, so its Wrapped reads "so far". */
export function isYearInProgress(year: number, now = new Date()): boolean {
  return year === now.getUTCFullYear();
}

function scoredValues(work: WorkStatsData): [string, number][] {
  return Object.entries(work.userScores).filter(
    (entry): entry is [string, number] => isDefined(entry[1]) && !isNaN(entry[1]),
  );
}

/** Members who scored at least one of these works. */
export function activeMemberCount(workData: WorkStatsData[], members: Member[]): number {
  return members.filter((member) => workData.some((work) => isDefined(work.userScores[member.id])))
    .length;
}

const MAX_PICKS = 3;

/**
 * The year's best- and worst-rated works. A short year splits its works between
 * the two lists rather than showing the same film as both a top and bottom pick.
 */
export function computePicks(workData: WorkStatsData[]): {
  top: WorkStatsData[];
  bottom: WorkStatsData[];
} {
  const size = Math.min(MAX_PICKS, Math.floor(workData.length / 2));
  const byAverage = [...workData].sort((a, b) =>
    b.average !== a.average ? b.average - a.average : a.title.localeCompare(b.title),
  );
  return {
    top: byAverage.slice(0, size),
    bottom: byAverage.slice(byAverage.length - size).reverse(),
  };
}

export interface HotTake {
  member: { id: string; name: string; image?: string };
  title: string;
  imageUrl: string | undefined;
  memberScore: number;
  /** Mean of everyone else's score on the same work. */
  othersAverage: number;
  /** `memberScore - othersAverage`: positive when they liked it more than the club did. */
  gap: number;
}

/**
 * Each member's single score furthest from the rest of the club, biggest gap
 * first. The comparison is against the *other* scorers so a member's own score
 * does not pull the club average towards it. A member who never differed from
 * anyone has no hot take.
 */
export function computeHotTakes(workData: WorkStatsData[], members: Member[]): HotTake[] {
  const takes: HotTake[] = [];

  for (const member of members) {
    let best: HotTake | undefined;
    for (const work of workData) {
      const scores = scoredValues(work);
      const own = scores.find(([id]) => id === member.id)?.[1];
      const others = scores.filter(([id]) => id !== member.id).map(([, score]) => score);
      if (!isDefined(own) || others.length === 0) continue;

      const othersAverage = others.reduce((sum, score) => sum + score, 0) / others.length;
      const gap = own - othersAverage;
      if (Math.abs(gap) > Math.abs(best?.gap ?? 0)) {
        best = {
          member: { id: member.id, name: member.name, image: member.image },
          title: work.title,
          imageUrl: work.imageUrl,
          memberScore: own,
          othersAverage,
          gap,
        };
      }
    }
    if (isDefined(best)) takes.push(best);
  }

  return takes.sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));
}

export interface ClosestMatch {
  member: { id: string; name: string; image?: string };
  match: { id: string; name: string; image?: string };
  similarityPercent: number;
}

/** Each member's most like-minded clubmate, closest pairs first. */
export function computeClosestMatches(
  workData: WorkStatsData[],
  members: Member[],
): ClosestMatch[] {
  return members
    .map((member) => {
      const { mostSimilar } = computeTasteSimilarity(workData, members, member.id);
      if (!isDefined(mostSimilar)) return undefined;
      return {
        member: mostSimilar.memberA,
        match: mostSimilar.memberB,
        similarityPercent: mostSimilar.similarityPercent,
      };
    })
    .filter(isDefined)
    .sort((a, b) => b.similarityPercent - a.similarityPercent);
}

export function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}
