/**
 * Stand-in for `modern-screenshot`, which rasterises a DOM node through a
 * `<canvas>` jsdom cannot paint. Specs care that a card becomes an image the
 * user can keep, not about its pixels, so this hands back a blank canvas; pair
 * it with `mockCanvas()` (`@/mocks/canvas`) so that canvas can be encoded.
 *
 * Opt in per spec file (mirroring `@/mocks/agCharts`) with:
 *
 * ```ts
 * vi.mock("modern-screenshot", async () => await import("@/mocks/modernScreenshot"));
 * ```
 *
 * and make a capture fail with `vi.mocked(domToCanvas).mockRejectedValueOnce(…)`.
 */
export const domToCanvas = vi.fn(async () => document.createElement("canvas"));
