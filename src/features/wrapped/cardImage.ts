import { domToBlob } from "modern-screenshot";

/**
 * Cards are laid out at one fixed size and scaled to fit the screen, so a
 * phone, a laptop and the saved image all show the same layout.
 */
export const CARD_WIDTH = 360;
export const CARD_HEIGHT = 640;

/** Story-sized output: 1080 × 1920. */
const EXPORT_SCALE = 1080 / CARD_WIDTH;

export async function renderCardImage(element: HTMLElement): Promise<Blob> {
  return domToBlob(element, {
    type: "image/png",
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    scale: EXPORT_SCALE,
    // The on-screen fit-to-viewport scaling is not part of the image.
    style: { transform: "none" },
    // Posters and avatars are re-fetched to inline them. A cache hit can be a
    // response the <img> loaded without CORS headers, which taints the canvas.
    fetch: { bypassingCache: true },
  });
}
