import { clampScore, SCORE_MAX, SCORE_STEP } from "./scoreScale";

/**
 * ViewBox-space layout of the score dial's semicircular track. The arc spans
 * 180° from the left end (score 0) over the top (score 5) to the right end
 * (score 10), with its center on the bottom edge of the drawing area.
 */
export const DIAL_VIEWBOX_WIDTH = 200;
export const DIAL_VIEWBOX_HEIGHT = 112;
export const DIAL_CENTER_X = 100;
export const DIAL_CENTER_Y = 100;
export const DIAL_RADIUS = 84;

export const DIAL_TRACK_PATH = `M ${DIAL_CENTER_X - DIAL_RADIUS} ${DIAL_CENTER_Y} A ${DIAL_RADIUS} ${DIAL_RADIUS} 0 0 1 ${DIAL_CENTER_X + DIAL_RADIUS} ${DIAL_CENTER_Y}`;

/** 0 at the left end of the arc, 1 at the right end. */
export const scoreToFraction = (score: number): number => clampScore(score) / SCORE_MAX;

/** ViewBox coordinates of the handle for a given fraction along the arc. */
export const handlePosition = (fraction: number): { x: number; y: number } => {
  const angle = Math.PI * (1 - fraction);
  return {
    x: DIAL_CENTER_X + DIAL_RADIUS * Math.cos(angle),
    y: DIAL_CENTER_Y - DIAL_RADIUS * Math.sin(angle),
  };
};

/**
 * Maps a pointer position (in viewBox coordinates) to the nearest slider
 * score, snapped to SCORE_STEP. Only the angle around the arc's center
 * matters, so drags don't have to stay on the track; points at or below the
 * baseline clamp to the nearest end rather than wrapping around.
 */
export const scoreFromPoint = (x: number, y: number): number => {
  const dx = x - DIAL_CENTER_X;
  const dy = DIAL_CENTER_Y - y;
  if (dy <= 0) return dx < 0 ? 0 : SCORE_MAX;
  const fraction = 1 - Math.atan2(dy, dx) / Math.PI;
  return clampScore(Math.round((fraction * SCORE_MAX) / SCORE_STEP) * SCORE_STEP);
};
