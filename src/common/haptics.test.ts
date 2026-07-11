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

  it("falls back to clicking a hidden native switch without vibrate (iOS)", () => {
    const click = vi
      .spyOn(HTMLElement.prototype, "click")
      .mockImplementation(() => undefined);

    hapticTick();

    expect(click).toHaveBeenCalledTimes(1);
    const clicked = click.mock.contexts[0];
    expect(clicked).toBeInstanceOf(HTMLLabelElement);
    if (!(clicked instanceof HTMLLabelElement)) return;
    const input = clicked.querySelector("input");
    expect(input?.type).toBe("checkbox");
    expect(input?.hasAttribute("switch")).toBe(true);
    // The throwaway control must not linger in the document.
    expect(document.body.querySelector("label")).toBeNull();
  });
});
