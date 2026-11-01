import { z } from "zod";

import { hasElements } from "./checks/checks.js";
import { type DailyGameWork } from "./types/dailyGame";

export interface PoolWork<T> {
  id: string;
  title: string;
  data: T;
}

/**
 * What one club type's daily game needs to know about its media: how alike two
 * works are, what to tell the player they share, and which works make a fair
 * answer. `T` is that media's own metadata shape.
 */
export interface DailyGameRules<T> {
  /** A scorer in [0,1], weighted by how rare each shared tag is in `corpus`. */
  makeScorer: (corpus: readonly T[]) => (target: T, candidate: T) => number;
  /** What `guess` has in common with `answer`, phrased for the player. */
  clues: (guess: T, answer: T) => string[];
  year: (data: T) => number | undefined;
  /** Whether a work has enough metadata that the trail to it never runs cold. */
  canBeAnswer: (data: T) => boolean;
}

/**
 * Every work in the pool, ranked by how alike it is to the answer, with the
 * pool as the scorer's corpus. The answer is rank 1; ties keep a stable order
 * by title.
 */
export function rankPool<T>(
  answerId: string,
  pool: readonly PoolWork<T>[],
  rules: DailyGameRules<T>,
): DailyGameWork[] {
  const answer = pool.find((work) => work.id === answerId);
  if (answer === undefined) return [];
  const score = rules.makeScorer(pool.map((work) => work.data));
  const others = pool
    .filter((work) => work.id !== answerId)
    .map((work) => ({ work, score: score(answer.data, work.data) }))
    .sort((a, b) =>
      a.score === b.score ? a.work.title.localeCompare(b.work.title) : b.score - a.score,
    );
  return [answer, ...others.map(({ work }) => work)].map((work, index) => ({
    id: work.id,
    title: work.title,
    year: rules.year(work.data),
    rank: index + 1,
    clues: work.id === answerId ? [] : rules.clues(work.data, answer.data),
  }));
}

/**
 * The next answer: a random work that has never been one, or the work whose
 * last turn was longest ago once every work has had one. `pastAnswers` is
 * oldest first.
 */
export function pickAnswer(
  candidates: readonly string[],
  pastAnswers: readonly string[],
  random: () => number = Math.random,
): string | undefined {
  const used = new Set(pastAnswers);
  const fresh = candidates.filter((id) => !used.has(id));
  if (hasElements(fresh)) return fresh[Math.floor(random() * fresh.length)];
  const lastTurn = new Map(pastAnswers.map((id, index) => [id, index]));
  return [...candidates].sort((a, b) => (lastTurn.get(a) ?? 0) - (lastTurn.get(b) ?? 0))[0];
}

/** A real calendar date, `YYYY-MM-DD` — `2026-02-31` is refused. */
export const puzzleDateSchema = z.string().date();

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Players ask for their own local date, and time zones run from UTC−12 to
 * UTC+14, so a date within a day of the server's UTC date is somebody's today.
 * Anything further out would let a player read ahead.
 */
export function isSomebodysToday(date: string, now: Date): boolean {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.abs(Date.parse(`${date}T00:00:00Z`) - today) <= DAY_MS;
}

const isoDate = (time: number) => new Date(time).toISOString().slice(0, 10);

/**
 * Today and tomorrow in UTC, the days a scheduled run records an answer for.
 * Tomorrow is already today east of UTC.
 */
export function upcomingPuzzleDates(now: Date): string[] {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return [isoDate(today), isoDate(today + DAY_MS)];
}

/**
 * The puzzle's number: calendar days since the game's first puzzle, which is
 * #1. A day nobody played still counts.
 */
export function puzzleNumber(firstDate: string, date: string): number {
  return Math.round((Date.parse(date) - Date.parse(firstDate)) / DAY_MS) + 1;
}
