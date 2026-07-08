import { createHistogramData } from "../scoring";

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
