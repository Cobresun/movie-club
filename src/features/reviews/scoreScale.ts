/**
 * The 0-10 review score scale, shared across every score-entry surface so the
 * bounds live in one place instead of being re-hardcoded in each `<input>` and
 * validation check. `SCORE_STEP` is the increment a slider snaps to; the manual
 * number field keeps `step="any"` so precise decimals (e.g. 8.5) stay possible.
 */
export const SCORE_MIN = 0;
export const SCORE_MAX = 10;
export const SCORE_STEP = 0.5;

export const clampScore = (score: number): number =>
  Math.min(SCORE_MAX, Math.max(SCORE_MIN, score));

export const isValidScore = (score: number): boolean =>
  !Number.isNaN(score) && score >= SCORE_MIN && score <= SCORE_MAX;

/** Trim floating-point noise for display, matching ReviewView's table cells. */
export const formatScore = (score: number): string => String(Math.round(score * 100) / 100);

export interface ScoreInputSanitization {
  /** The corrected string to write back to the model and the DOM. */
  value: string;
  /** True when the raw text was altered — the caller shakes the field. */
  corrected: boolean;
  /** Set when the value was pulled to a bound, so the caller can explain it. */
  clampedTo?: "min" | "max";
}

/**
 * Normalize what a `<input type="number">` hands us into a legal score string.
 * A number input happily keeps otherwise-nonsense text in its `value` — leading
 * zeros ("00", "08", "007"), a third decimal digit, or an out-of-range number —
 * because each is still a valid float literal. This is the single guard every
 * score-entry surface runs typed input through so those never survive.
 *
 * Order matters: strip leading zeros first so "007.555" collapses to "7.55"
 * rather than tripping over its own zeros. Partial states the user is still
 * typing ("", "8.", "0.") pass through untouched.
 */
export const sanitizeScoreInput = (raw: string): ScoreInputSanitization => {
  let value = raw;
  let corrected = false;

  // A leading zero before another digit is never how you type a 0-10 score.
  // Preserve a lone "0" and the "0" in "0.5"; drop the rest ("00" -> "0").
  const withoutLeadingZeros = value.replace(/^(-?)0+(\d)/, "$1$2");
  if (withoutLeadingZeros !== value) {
    value = withoutLeadingZeros;
    corrected = true;
  }

  // Keep at most two decimals — the precision every score display rounds to.
  const excessDecimals = /^(-?\d*\.\d{2})\d/.exec(value);
  if (excessDecimals !== null) {
    value = excessDecimals[1];
    corrected = true;
  }

  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed)) return { value, corrected };
  if (parsed > SCORE_MAX) {
    return { value: String(SCORE_MAX), corrected: true, clampedTo: "max" };
  }
  if (parsed < SCORE_MIN) {
    return { value: String(SCORE_MIN), corrected: true, clampedTo: "min" };
  }
  return { value, corrected };
};
