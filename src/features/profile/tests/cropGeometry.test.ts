import { MAX_ZOOM, centeredCrop, clampCrop, cropRect, panCrop } from "../cropGeometry";

const landscape = { width: 1600, height: 1200 };
const portrait = { width: 900, height: 1600 };

describe("cropRect", () => {
  it("starts as the largest square centred on the photo", () => {
    expect(cropRect(landscape, centeredCrop(landscape))).toEqual({ x: 200, y: 0, size: 1200 });
    expect(cropRect(portrait, centeredCrop(portrait))).toEqual({ x: 0, y: 350, size: 900 });
  });

  it("shrinks the square around its centre as the zoom grows", () => {
    const crop = { ...centeredCrop(landscape), zoom: 2 };

    expect(cropRect(landscape, crop)).toEqual({ x: 500, y: 300, size: 600 });
  });
});

describe("panCrop", () => {
  it("dragging the photo right shows more of its left side", () => {
    const moved = panCrop(landscape, centeredCrop(landscape), 50, 0, 300);

    // A 300px preview of a 1200px square: each preview pixel is four photo pixels.
    expect(cropRect(landscape, moved).x).toBe(0);
  });

  it("stops at the photo's edge", () => {
    const moved = panCrop(landscape, centeredCrop(landscape), -1000, 1000, 300);

    expect(cropRect(landscape, moved)).toEqual({ x: 400, y: 0, size: 1200 });
  });

  it("moves a shorter way across the photo per preview pixel when zoomed in", () => {
    const zoomedIn = { ...centeredCrop(landscape), zoom: 4 };

    const moved = panCrop(landscape, zoomedIn, 0, -30, 300);

    expect(cropRect(landscape, moved).y).toBe(450 + 30);
  });
});

describe("clampCrop", () => {
  it("keeps the zoom between showing the whole short side and the maximum", () => {
    expect(clampCrop(landscape, { ...centeredCrop(landscape), zoom: 0.2 }).zoom).toBe(1);
    expect(clampCrop(landscape, { ...centeredCrop(landscape), zoom: 99 }).zoom).toBe(MAX_ZOOM);
  });

  it("pulls a zoomed-in corner crop back inside the photo as it zooms out", () => {
    const corner = { centerX: 150, centerY: 150, zoom: 4 };

    const zoomedOut = clampCrop(landscape, { ...corner, zoom: 1 });

    expect(cropRect(landscape, zoomedOut)).toEqual({ x: 0, y: 0, size: 1200 });
  });
});
