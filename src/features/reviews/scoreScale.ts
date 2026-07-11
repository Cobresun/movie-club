/**
 * The 0-10 review score scale, shared across every score-entry surface so the
 * bounds live in one place instead of being re-hardcoded in each `<input>` and
 * validation check. `SCORE_STEP` is the increment a slider snaps to; the manual
 * number field keeps `step="any"` so precise decimals (e.g. 8.5) stay possible.
 */
export const SCORE_MIN = 0;
export const SCORE_MAX = 10;
export const SCORE_STEP = 0.25;

export const clampScore = (score: number): number =>
  Math.min(SCORE_MAX, Math.max(SCORE_MIN, score));

export const isValidScore = (score: number): boolean =>
  !Number.isNaN(score) && score >= SCORE_MIN && score <= SCORE_MAX;

/** Trim floating-point noise for display, matching ReviewView's table cells. */
export const formatScore = (score: number): string =>
  String(Math.round(score * 100) / 100);
