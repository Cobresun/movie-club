/**
 * A crop is the centre of a square in source-image pixels plus a zoom, where
 * zoom 1 is the largest square the image can hold. Keeping it in image pixels
 * means the preview and the exported photo read the same rectangle no matter
 * how large the preview is drawn.
 */
export interface CropState {
  centerX: number;
  centerY: number;
  zoom: number;
}

export interface ImageSize {
  width: number;
  height: number;
}

export interface CropRect {
  x: number;
  y: number;
  size: number;
}

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const cropSide = (image: ImageSize, zoom: number) => Math.min(image.width, image.height) / zoom;

export function centeredCrop(image: ImageSize): CropState {
  return { centerX: image.width / 2, centerY: image.height / 2, zoom: MIN_ZOOM };
}

/** Pulls a crop back inside the image, so the square never shows past an edge. */
export function clampCrop(image: ImageSize, crop: CropState): CropState {
  const zoom = clamp(crop.zoom, MIN_ZOOM, MAX_ZOOM);
  const half = cropSide(image, zoom) / 2;
  return {
    zoom,
    centerX: clamp(crop.centerX, half, image.width - half),
    centerY: clamp(crop.centerY, half, image.height - half),
  };
}

/**
 * Moves the crop as though the photo were dragged `dx`, `dy` pixels across a
 * preview `previewSize` pixels wide — the square travels the opposite way.
 */
export function panCrop(
  image: ImageSize,
  crop: CropState,
  dx: number,
  dy: number,
  previewSize: number,
): CropState {
  const imagePixelsPerPreviewPixel = cropSide(image, crop.zoom) / previewSize;
  return clampCrop(image, {
    ...crop,
    centerX: crop.centerX - dx * imagePixelsPerPreviewPixel,
    centerY: crop.centerY - dy * imagePixelsPerPreviewPixel,
  });
}

export function cropRect(image: ImageSize, crop: CropState): CropRect {
  const size = cropSide(image, crop.zoom);
  return { x: crop.centerX - size / 2, y: crop.centerY - size / 2, size };
}
