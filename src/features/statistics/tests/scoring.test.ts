import {
  normalizeArray,
  createHistogramData,
  getScoreContextColor,
} from "../scoring";

// ---------- normalizeArray ----------

describe("normalizeArray", () => {
  it("returns empty array for empty input", () => {
    expect(normalizeArray([])).toEqual([]);
  });

  it("returns all zeros when all values are identical", () => {
    expect(normalizeArray([5, 5, 5, 5])).toEqual([0, 0, 0, 0]);
  });

  it("returns NaN for single element (variance divides by count-1=0)", () => {
    const result = normalizeArray([7]);
    expect(result).toHaveLength(1);
    expect(result[0]).toBeNaN();
  });

  it("normalizes correctly with known values", () => {
    // [2, 4, 6] → mean=4, std=2
    // z-scores: (2-4)/2=-1, (4-4)/2=0, (6-4)/2=1
    const result = normalizeArray([2, 4, 6]);
    expect(result).toEqual([-1, 0, 1]);
  });

  it("handles negative z-scores and positive z-scores", () => {
    const result = normalizeArray([1, 5, 9]);
    // mean=5, variance=((1-5)^2+(5-5)^2+(9-5)^2)/2=16, std=4
    // z: (1-5)/4=-1, (5-5)/4=0, (9-5)/4=1
    expect(result[0]).toBeLessThan(0);
    expect(result[1]).toBe(0);
    expect(result[2]).toBeGreaterThan(0);
  });

  it("rounds to 2 decimal places", () => {
    const result = normalizeArray([1, 2, 3, 4, 5]);
    for (const val of result) {
      const decimals = val.toString().split(".")[1];
      if (decimals) {
        expect(decimals.length).toBeLessThanOrEqual(2);
      }
    }
  });

  it("substitutes mean for undefined values", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- testing undefined handling
    const input = [2, undefined as any, 6];
    const result = normalizeArray(input);
    // mean of valid scores [2, 6] = 4, std from [2,6]: variance=(4+4)/1=8, std=2.83
    // undefined → replaced with mean (4), z-score = 0
    expect(result[1]).toBe(0);
  });
});

// ---------- createHistogramData ----------

describe("createHistogramData", () => {
  it("returns empty array for empty scores", () => {
    expect(createHistogramData([])).toEqual([]);
  });

  it("creates 11 bins (0-10)", () => {
    const result = createHistogramData([5, 7, 3]);
    expect(result).toHaveLength(11);
    expect(result[0].bin).toBe(0);
    expect(result[10].bin).toBe(10);
  });

  it("each bin has the correct bin number", () => {
    const result = createHistogramData([1, 2]);
    for (let i = 0; i <= 10; i++) {
      expect(result[i].bin).toBe(i);
    }
  });
});

// ---------- getScoreContextColor ----------

describe("getScoreContextColor", () => {
  it('returns "transparent" for undefined', () => {
    expect(getScoreContextColor(undefined)).toBe("transparent");
  });

  it('returns "transparent" for NaN', () => {
    expect(getScoreContextColor(NaN)).toBe("transparent");
  });

  it('returns "transparent" for values in dead zone (|z| < 0.1)', () => {
    expect(getScoreContextColor(0)).toBe("transparent");
    expect(getScoreContextColor(0.05)).toBe("transparent");
    expect(getScoreContextColor(-0.09)).toBe("transparent");
  });

  it("returns green rgba for positive z-scores", () => {
    const color = getScoreContextColor(1.0);
    expect(color).toMatch(/^rgba\(34, 197, 94,/);
  });

  it("returns red rgba for negative z-scores", () => {
    const color = getScoreContextColor(-1.0);
    expect(color).toMatch(/^rgba\(239, 68, 68,/);
  });

  it("increases opacity with larger absolute z-scores", () => {
    const extractOpacity = (color: string) =>
      parseFloat(color.split(",")[3].replace(")", "").trim());

    const lowOpacity = extractOpacity(getScoreContextColor(0.5)!);
    const highOpacity = extractOpacity(getScoreContextColor(1.5)!);
    expect(highOpacity).toBeGreaterThan(lowOpacity);
  });

  it("caps opacity at maxOpacity (0.45)", () => {
    const color = getScoreContextColor(10);
    const opacity = parseFloat(color.split(",")[3].replace(")", "").trim());
    expect(opacity).toBe(0.45);
  });

  it("boundary: z-score of exactly 0.1 is not transparent", () => {
    expect(getScoreContextColor(0.1)).not.toBe("transparent");
  });

  it("boundary: z-score of exactly -0.1 is not transparent", () => {
    expect(getScoreContextColor(-0.1)).not.toBe("transparent");
  });
});
