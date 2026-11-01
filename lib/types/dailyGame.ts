import { type ClubType } from "./generated/db";

/** One work in a day's daily-game pool, ranked against that day's answer. */
export interface DailyGameWork {
  /** The work's external id (a TMDB id for movies). */
  id: string;
  title: string;
  year?: number;
  /** 1 for the answer, up to the pool size for the least alike work. */
  rank: number;
  /** What this work has in common with the answer, as the player sees it. */
  clues: string[];
}

/**
 * `GET /api/daily-game/:clubType/:date` — a day's puzzle for one club type's
 * game, every guessable work already ranked.
 */
export interface DailyGamePuzzle {
  clubType: ClubType;
  /** The calendar day this puzzle belongs to, `YYYY-MM-DD`. */
  date: string;
  /** Counts the days this game has been played, starting at 1. */
  puzzle: number;
  works: DailyGameWork[];
}
