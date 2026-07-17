import { scoreBand } from "../scoreBands";
import {
  DIAL_CENTER_X,
  DIAL_CENTER_Y,
  DIAL_RADIUS,
  handlePosition,
  scoreFromPoint,
  scoreToFraction,
} from "../scoreDialGeometry";
import { sanitizeScoreInput } from "../scoreScale";

describe("scoreBand", () => {
  it.each<[number, string]>([
    [0, "Awful"],
    [1.99, "Awful"],
    [2, "Bad"],
    [4.4, "Meh"],
    [5.5, "Decent"],
    [7.1, "Good"],
    [8.5, "Great"],
    [9.99, "Great"],
    [10, "Masterpiece"],
  ])("labels %s as %s", (score, label) => {
    expect(scoreBand(score).label).toBe(label);
  });
});

describe("score dial geometry", () => {
  it("maps scores across the semicircle, clamping out-of-range values", () => {
    expect(scoreToFraction(0)).toBe(0);
    expect(scoreToFraction(5)).toBe(0.5);
    expect(scoreToFraction(10)).toBe(1);
    expect(scoreToFraction(12)).toBe(1);
  });

  it("places the handle along the arc", () => {
    const left = handlePosition(0);
    expect(left.x).toBeCloseTo(DIAL_CENTER_X - DIAL_RADIUS);
    expect(left.y).toBeCloseTo(DIAL_CENTER_Y);

    const top = handlePosition(0.5);
    expect(top.x).toBeCloseTo(DIAL_CENTER_X);
    expect(top.y).toBeCloseTo(DIAL_CENTER_Y - DIAL_RADIUS);

    const right = handlePosition(1);
    expect(right.x).toBeCloseTo(DIAL_CENTER_X + DIAL_RADIUS);
    expect(right.y).toBeCloseTo(DIAL_CENTER_Y);
  });

  it("maps pointer angles back to scores snapped to half steps", () => {
    expect(scoreFromPoint(DIAL_CENTER_X, DIAL_CENTER_Y - DIAL_RADIUS)).toBe(5);

    // A point at the angle for 7.1 snaps to the nearest half step.
    const angle = Math.PI * (1 - 0.71);
    expect(
      scoreFromPoint(
        DIAL_CENTER_X + DIAL_RADIUS * Math.cos(angle),
        DIAL_CENTER_Y - DIAL_RADIUS * Math.sin(angle),
      ),
    ).toBe(7);

    // Only the angle matters, not the distance from the center, so drags
    // don't have to stay on the track. 45° above center → three quarters.
    expect(scoreFromPoint(DIAL_CENTER_X + 10, DIAL_CENTER_Y - 10)).toBe(7.5);
  });

  it("clamps points at or below the baseline to the nearest end", () => {
    expect(scoreFromPoint(DIAL_CENTER_X - 50, DIAL_CENTER_Y + 30)).toBe(0);
    expect(scoreFromPoint(DIAL_CENTER_X + 50, DIAL_CENTER_Y + 30)).toBe(10);
    expect(scoreFromPoint(DIAL_CENTER_X - DIAL_RADIUS, DIAL_CENTER_Y)).toBe(0);
    expect(scoreFromPoint(DIAL_CENTER_X + DIAL_RADIUS, DIAL_CENTER_Y)).toBe(10);
  });
});

describe("sanitizeScoreInput", () => {
  it("leaves legal input untouched", () => {
    for (const value of ["", "0", "0.5", "8", "8.5", "8.25", "10", "8."]) {
      expect(sanitizeScoreInput(value)).toEqual({ value, corrected: false });
    }
  });

  it("strips leading zeros a number input keeps in its value", () => {
    // The reported bug: "00" reads as an in-range 0 and used to slip through.
    expect(sanitizeScoreInput("00")).toEqual({ value: "0", corrected: true });
    expect(sanitizeScoreInput("000")).toEqual({ value: "0", corrected: true });
    expect(sanitizeScoreInput("08")).toEqual({ value: "8", corrected: true });
    expect(sanitizeScoreInput("007")).toEqual({ value: "7", corrected: true });
    expect(sanitizeScoreInput("00.5")).toEqual({
      value: "0.5",
      corrected: true,
    });
  });

  it("caps a third decimal, matching the two-decimal display precision", () => {
    expect(sanitizeScoreInput("8.555")).toEqual({
      value: "8.55",
      corrected: true,
    });
    // Leading zeros are stripped before decimals are counted.
    expect(sanitizeScoreInput("007.555")).toEqual({
      value: "7.55",
      corrected: true,
    });
  });

  it("clamps out-of-range values to the nearest bound", () => {
    expect(sanitizeScoreInput("12")).toEqual({
      value: "10",
      corrected: true,
      clampedTo: "max",
    });
    expect(sanitizeScoreInput("-5")).toEqual({
      value: "0",
      corrected: true,
      clampedTo: "min",
    });
    // Leading-zero strip runs first, then the clamp sees the real magnitude.
    expect(sanitizeScoreInput("-05")).toEqual({
      value: "0",
      corrected: true,
      clampedTo: "min",
    });
  });
});
