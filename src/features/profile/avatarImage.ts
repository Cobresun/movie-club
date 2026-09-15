import { isDefined } from "../../../lib/checks/checks.js";
import type { CropRect } from "./cropGeometry";

/**
 * A phone photo decodes to tens of megapixels. Scaling it down once, up front,
 * keeps every preview redraw cheap and still leaves a full-resolution avatar
 * at maximum zoom.
 */
const WORKING_MAX_SIDE = 2048;

/** Side of the square photo that is uploaded; well under the function's body limit. */
const AVATAR_SIZE = 512;

/** Rejects when the browser can't decode the file (HEIC outside Safari, a non-image). */
export async function decodePhoto(file: Blob): Promise<ImageBitmap> {
  const original = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = WORKING_MAX_SIDE / Math.max(original.width, original.height);
  if (scale >= 1) return original;

  const resized = await createImageBitmap(original, {
    resizeWidth: Math.round(original.width * scale),
    resizeHeight: Math.round(original.height * scale),
    resizeQuality: "high",
  });
  original.close();
  return resized;
}

/** Fills `canvas` with the `rect` of `image`. */
export function drawCrop(canvas: HTMLCanvasElement, image: ImageBitmap, rect: CropRect): void {
  const context = canvas.getContext("2d");
  if (!isDefined(context)) return;

  context.imageSmoothingQuality = "high";
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, rect.x, rect.y, rect.size, rect.size, 0, 0, canvas.width, canvas.height);
}

/**
 * The cropped photo, encoded for upload. WebP keeps a transparent background
 * transparent; a browser that can't encode it hands back a PNG instead.
 */
export async function exportCrop(image: ImageBitmap, rect: CropRect): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  drawCrop(canvas, image, rect);

  return await new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (isDefined(blob)) resolve(blob);
        else reject(new Error("Could not encode the cropped photo"));
      },
      "image/webp",
      0.9,
    );
  });
}
