import { type ClubType } from "./generated/db";

/** How much a clue counts towards a guess's rank, as the player sees it. */
export type ClueStrength = "strong" | "medium" | "weak";

/** One thing a guess has in common with the answer. */
export interface DailyGameClue {
  text: string;
  strength: ClueStrength;
}

/** One work in a day's daily-game pool, ranked against that day's answer. */
export interface DailyGameWork {
  /** The work's external id (a TMDB id for movies). */
  id: string;
  title: string;
  year?: number;
  /** 1 for the answer, up to the pool size for the least alike work. */
  rank: number;
  /**
   * What this work has in common with the answer, strongest first. These are
   * the whole of what ranks it: nothing the player can't see counts.
   */
  clues: DailyGameClue[];
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
