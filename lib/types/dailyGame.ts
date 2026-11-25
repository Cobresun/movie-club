import { type ClubType } from "./generated/db";

/** One thing a guess has in common with the answer, or one way it differs from it. */
export interface DailyGameClue {
  text: string;
  /** True for something the guess shares with the answer, false where it differs. */
  shared: boolean;
  /** Marks the clue about when the work came out, which the board folds into its year chip. */
  era?: boolean;
}

/** One work in a day's daily-game pool, ranked against that day's answer. */
export interface DailyGameWork {
  /** The work's external id (a TMDB id for movies). */
  id: string;
  title: string;
  year?: number;
  /** A small poster or cover, sized for a thumbnail. */
  imageUrl?: string;
  /** 1 for the answer, up to the pool size for the least alike work. */
  rank: number;
  /**
   * What this work shares with the answer and where it differs, strongest
   * first. Its rank comes from these and nothing else: equal clues go to the
   * work released nearer the answer.
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

/** One day's puzzle as the archive lists it — never with its answer. */
export interface DailyGameArchiveEntry {
  date: string;
  puzzle: number;
}

/**
 * `GET /api/daily-game/:clubType/archive` — every puzzle the game has had, up
 * to the furthest-ahead day somewhere in the world, newest first.
 */
export interface DailyGameArchive {
  clubType: ClubType;
  puzzles: DailyGameArchiveEntry[];
}
