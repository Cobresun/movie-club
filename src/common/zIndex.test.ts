import { describe, expect, it } from "vitest";

import { lowerZIndex, zIndexClass } from "./zIndex";

describe("zIndexClass", () => {
  it.each([
    ["40", "z-40"],
    ["50", "z-50"],
    ["60", "z-[60]"],
  ] as const)("maps %s to %s", (zIndex, expected) => {
    expect(zIndexClass(zIndex)).toBe(expected);
  });
});

describe("lowerZIndex", () => {
  it.each([
    ["40", "40"],
    ["50", "40"],
    ["60", "50"],
  ] as const)("maps %s to %s", (zIndex, expected) => {
    expect(lowerZIndex(zIndex)).toBe(expected);
  });
});
