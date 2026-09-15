/**
 * Stub the image decoding and canvas encoding jsdom lacks: `createImageBitmap`
 * doesn't exist, and a canvas has neither a 2D context nor `toBlob`. Anything
 * that opens a picked photo in the cropper needs this.
 *
 * Photos decode to a `width` × `height` bitmap; pass `decodable: false` for a
 * file the browser can't read, such as HEIC outside Safari.
 */
export function mockCanvas({ width = 1600, height = 1200, decodable = true } = {}): void {
  vi.stubGlobal("createImageBitmap", async (): Promise<ImageBitmap> => {
    if (!decodable) throw new DOMException("The source image could not be decoded.");
    return { width, height, close: () => undefined };
  });

  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) => {
    callback(new Blob(["cropped-photo"], { type: "image/webp" }));
  });
}
