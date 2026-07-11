/**
 * Verdict bands for the score dial: each score maps to a label and an accent
 * color used for the arc fill, the score readout, and the clamp notice pill.
 * Registry-style (like CLUB_TYPE_CONFIG) so new bands are one entry here, not
 * conditionals scattered through the dial.
 */
export interface ScoreBand {
  /** Inclusive lower bound; a score belongs to the last band it reaches. */
  min: number;
  label: string;
  /** Hex accent color, tuned for the dark background. */
  color: string;
}

export const SCORE_BANDS: ReadonlyArray<ScoreBand> = [
  { min: 0, label: "Awful", color: "#ef4444" },
  { min: 2, label: "Bad", color: "#f97316" },
  { min: 4, label: "Meh", color: "#eab308" },
  { min: 5.5, label: "Decent", color: "#cddc39" },
  { min: 7, label: "Good", color: "#84cc16" },
  { min: 8.5, label: "Great", color: "#22c55e" },
  { min: 10, label: "Masterpiece", color: "#00e054" },
];

export const scoreBand = (score: number): ScoreBand =>
  SCORE_BANDS.reduce((current, band) => (score >= band.min ? band : current));
