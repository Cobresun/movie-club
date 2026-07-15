/**
 * Haptic feedback for touch interactions, via the Vibration API. Must be
 * called from within a user gesture (e.g. a pointer event handler) — the
 * Vibration API requires transient user activation and silently no-ops
 * without it.
 *
 * Supported on Android (Chrome/Firefox). iOS Safari has never implemented
 * `navigator.vibrate`, so this is a harmless no-op there and on desktop.
 */

const TICK_MS = 10;

/** Fire a single short haptic tick, e.g. when a control crosses a detent. */
export const hapticTick = (): void => {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(TICK_MS);
  }
};
