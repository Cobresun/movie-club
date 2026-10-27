/** One movie in a day's Closer pool, ranked against that day's answer. */
export interface DailyGameMovie {
  /** The movie's TMDB id. */
  id: string;
  title: string;
  year?: number;
  /** 1 for the answer, up to the pool size for the least alike movie. */
  rank: number;
  /** What this movie has in common with the answer, as the player sees it. */
  clues: string[];
}

/** `GET /api/daily-game/:date` — a day's puzzle, every guessable movie already ranked. */
export interface DailyGamePuzzle {
  /** The calendar day this puzzle belongs to, `YYYY-MM-DD`. */
  date: string;
  /** Counts the days Closer has been played, starting at 1. */
  puzzle: number;
  movies: DailyGameMovie[];
}
