import { domToBlob } from "modern-screenshot";

/** Story-sized output (1080 × 1920 for a 9:16 card), whatever size it renders at on screen. */
const EXPORT_WIDTH = 1080;

export async function renderCardImage(element: HTMLElement): Promise<Blob> {
  const { width } = element.getBoundingClientRect();
  return domToBlob(element, {
    type: "image/png",
    scale: width > 0 ? EXPORT_WIDTH / width : 1,
    // Square corners: the rounding is on-screen chrome, not part of the image.
    style: { borderRadius: "0" },
    // Posters and avatars are re-fetched to inline them. A cache hit can be a
    // response the <img> loaded without CORS headers, which taints the canvas.
    fetch: { bypassingCache: true },
  });
}
