/**
 * Cross-platform haptic feedback for touch interactions. Must be called from
 * within a user gesture (e.g. a pointer event handler) — both platform paths
 * below require transient user activation and silently no-op without it.
 *
 * - Android (Chrome/Firefox): the Vibration API.
 * - iOS (18+): Safari never implemented `navigator.vibrate`, but toggling a
 *   native switch control (`<input type="checkbox" switch>`) via a label
 *   click fires the system haptic tick, so we synthesize one off-DOM.
 *
 * Everywhere else (desktop, older iOS) this is a harmless no-op.
 */

const TICK_MS = 10;

const clickHiddenSwitch = (): void => {
  const label = document.createElement("label");
  label.ariaHidden = "true";
  label.style.display = "none";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.setAttribute("switch", "");
  label.append(input);
  document.body.append(label);
  label.click();
  label.remove();
};

/** Fire a single short haptic tick, e.g. when a control crosses a detent. */
export const hapticTick = (): void => {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(TICK_MS);
    return;
  }
  clickHiddenSwitch();
};
