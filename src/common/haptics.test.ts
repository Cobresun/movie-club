import { afterEach, describe, expect, it, vi } from "vitest";

import { hapticTick } from "./haptics";

describe("hapticTick", () => {
  afterEach(() => {
    // jsdom's navigator has no vibrate; remove whatever a test added so each
    // test chooses its own platform path.
    Reflect.deleteProperty(navigator, "vibrate");
    vi.restoreAllMocks();
  });

  it("uses the Vibration API when the browser supports it", () => {
    const vibrate = vi.fn(() => true);
    navigator.vibrate = vibrate;

    hapticTick();

    expect(vibrate).toHaveBeenCalledTimes(1);
    expect(vibrate).toHaveBeenCalledWith(10);
  });

  it("no-ops when the browser has no Vibration API (iOS Safari, desktop)", () => {
    // jsdom's navigator has no vibrate, so this is the unsupported path.
    expect(() => hapticTick()).not.toThrow();
  });
});
