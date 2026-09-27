import { domToCanvas } from "modern-screenshot";

import { hasValue, isDefined } from "../../../lib/checks/checks.js";

/**
 * Cards are laid out at one fixed size and scaled to fit the screen, so a
 * phone, a laptop and the saved image all show the same layout.
 */
export const CARD_WIDTH = 360;
export const CARD_HEIGHT = 640;

/** Story-sized output: 1080 × 1920. */
const EXPORT_SCALE = 1080 / CARD_WIDTH;

/** A 1×1 transparent GIF, handed to the DOM capture in place of every real image. */
const BLANK_IMAGE =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

/** Where an image sits on the card, in the card's own 360 × 640 space. */
interface ImagePlacement {
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
  hasShadow: boolean;
}

/**
 * Renders a card to a PNG in two passes. Text, gradients and layout come from a
 * DOM capture with every image hidden; posters and avatars are then painted
 * straight onto the canvas. The capture draws through an SVG `foreignObject`,
 * and iOS Safari routinely leaves images out of those, so images never go
 * through it.
 */
export async function renderCardImage(element: HTMLElement): Promise<Blob> {
  const placements = Array.from(element.querySelectorAll("img"), (image) =>
    placeImage(image, element),
  );

  const [canvas, bitmaps] = await Promise.all([
    domToCanvas(element, {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      scale: EXPORT_SCALE,
      // The on-screen fit-to-viewport scaling is not part of the image.
      style: { transform: "none" },
      fetchFn: async () => BLANK_IMAGE,
      onCloneEachNode: (cloned) => {
        if (cloned instanceof HTMLImageElement) cloned.style.visibility = "hidden";
      },
    }),
    Promise.all(placements.map((placement) => loadBitmap(placement.src))),
  ]);

  const context = canvas.getContext("2d");
  if (isDefined(context)) {
    // In document order, so overlapping avatars stack the way they do on screen.
    placements.forEach((placement, index) => {
      paintImage(context, bitmaps[index], placement);
    });
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob === null) reject(new Error("The card could not be encoded as an image"));
      else resolve(blob);
    }, "image/png");
  });
}

function placeImage(image: HTMLImageElement, card: HTMLElement): ImagePlacement {
  const cardBox = card.getBoundingClientRect();
  const box = image.getBoundingClientRect();
  // The card is scaled on screen; measure back into its unscaled size.
  const screenScale = cardBox.width / CARD_WIDTH;
  const style = getComputedStyle(image);
  const radius = Number.parseFloat(style.borderTopLeftRadius);
  return {
    src: hasValue(image.currentSrc) ? image.currentSrc : image.src,
    x: (box.left - cardBox.left) / screenScale,
    y: (box.top - cardBox.top) / screenScale,
    width: box.width / screenScale,
    height: box.height / screenScale,
    radius: Number.isNaN(radius) ? 0 : radius,
    hasShadow: style.boxShadow !== "none",
  };
}

/**
 * A fresh CORS fetch: a cached copy the page's `<img>` loaded without CORS
 * would taint the canvas. An image that can't be fetched is left out rather
 * than failing the whole card.
 */
async function loadBitmap(src: string): Promise<ImageBitmap | undefined> {
  try {
    const response = await fetch(src, { mode: "cors", cache: "no-store" });
    if (!response.ok) return undefined;
    return await createImageBitmap(await response.blob());
  } catch {
    return undefined;
  }
}

/**
 * Draws with `object-fit: cover` and the element's own corner rounding. An image
 * that couldn't be loaded becomes the same faint tile a work without a poster
 * gets on screen.
 */
function paintImage(
  context: CanvasRenderingContext2D,
  bitmap: ImageBitmap | undefined,
  placement: ImagePlacement,
): void {
  const x = placement.x * EXPORT_SCALE;
  const y = placement.y * EXPORT_SCALE;
  const width = placement.width * EXPORT_SCALE;
  const height = placement.height * EXPORT_SCALE;
  const radius = Math.min(placement.radius * EXPORT_SCALE, width / 2, height / 2);

  context.save();
  if (!isDefined(bitmap)) {
    context.fillStyle = "rgba(255, 255, 255, 0.1)";
    context.beginPath();
    context.roundRect(x, y, width, height, radius);
    context.fill();
    context.restore();
    return;
  }
  if (placement.hasShadow) {
    context.shadowColor = "rgba(0, 0, 0, 0.35)";
    context.shadowBlur = 15 * EXPORT_SCALE;
    context.shadowOffsetY = 8 * EXPORT_SCALE;
    context.fillStyle = "black";
    context.beginPath();
    context.roundRect(x, y, width, height, radius);
    context.fill();
    context.shadowColor = "transparent";
  }
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.clip();
  const cover = Math.max(width / bitmap.width, height / bitmap.height);
  const sourceWidth = width / cover;
  const sourceHeight = height / cover;
  context.drawImage(
    bitmap,
    (bitmap.width - sourceWidth) / 2,
    (bitmap.height - sourceHeight) / 2,
    sourceWidth,
    sourceHeight,
    x,
    y,
    width,
    height,
  );
  context.restore();
}
