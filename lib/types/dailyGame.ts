import { type ClubType } from "./generated/db";

/**
 * One thing a guess has in common with the answer, worth points, or one way it
 * differs from it, worth negative points or none. The player sees the points.
 */
export interface DailyGameClue {
  text: string;
  points: number;
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
   * What this work shares with the answer and where it differs, most points
   * first. Their points add up to its score: nothing the player can't see
   * counts. Equal scores go to the work released nearer the answer.
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
