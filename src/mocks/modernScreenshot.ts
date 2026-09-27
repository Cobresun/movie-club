/**
 * Stand-in for `modern-screenshot`, which rasterises a DOM node through a
 * `<canvas>` jsdom cannot paint. Specs care that a card becomes an image the
 * user can keep, not about its pixels.
 *
 * Opt in per spec file (mirroring `@/mocks/agCharts`) with:
 *
 * ```ts
 * vi.mock("modern-screenshot", async () => await import("@/mocks/modernScreenshot"));
 * ```
 *
 * and make a capture fail with `vi.mocked(domToBlob).mockRejectedValueOnce(…)`.
 */
export const domToBlob = vi.fn(async () => new Blob(["card"], { type: "image/png" }));
