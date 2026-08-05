import {
  axisLabelFontSize,
  baseChartOptions,
  baseLegendOptions,
  CLUB_SERIES_COLOR,
  MEMBER_SERIES_COLORS,
  memberSeriesColor,
} from "@/common/chartPalette";

/**
 * The palette is the statistics page's single source of chart-color truth
 * (#412). What matters is that a member keeps one colour across every chart on
 * the page, and that `compact` really is the smaller phone rendering.
 */
describe("memberSeriesColor", () => {
  it("gives each member their own slot, in fixed order", () => {
    const colors = MEMBER_SERIES_COLORS.map((_, index) => memberSeriesColor(index));

    expect(colors).toEqual([...MEMBER_SERIES_COLORS]);
    expect(new Set(colors).size).toBe(MEMBER_SERIES_COLORS.length);
  });

  it("is stable for a given index, so a member's colour matches across charts", () => {
    expect(memberSeriesColor(3)).toBe(memberSeriesColor(3));
  });

  it("wraps around past the last slot rather than returning nothing", () => {
    const size = MEMBER_SERIES_COLORS.length;

    expect(memberSeriesColor(size)).toBe(memberSeriesColor(0));
    expect(memberSeriesColor(size + 2)).toBe(memberSeriesColor(2));
  });

  it("never hands a member the single-series club colour", () => {
    expect(MEMBER_SERIES_COLORS).not.toContain(CLUB_SERIES_COLOR);
  });
});

describe("baseChartOptions", () => {
  it("renders a shorter chart in compact mode", () => {
    expect(baseChartOptions(true).height).toBeLessThan(Number(baseChartOptions(false).height));
  });

  it("keeps the page background showing through", () => {
    expect(baseChartOptions(false).background?.visible).toBe(false);
  });

  it("trims padding in compact mode so the plot area keeps its width", () => {
    expect(baseChartOptions(true).padding).toEqual({ top: 8, right: 8, bottom: 0, left: 0 });
  });
});

describe("baseLegendOptions", () => {
  it("puts the legend below the plot at both breakpoints", () => {
    expect(baseLegendOptions(true).position).toBe("bottom");
    expect(baseLegendOptions(false).position).toBe("bottom");
  });

  it("shrinks the legend markers, spacing and labels in compact mode", () => {
    const compact = baseLegendOptions(true).item;
    const full = baseLegendOptions(false).item;

    expect(Number(compact?.marker?.size)).toBeLessThan(Number(full?.marker?.size));
    expect(Number(compact?.paddingX)).toBeLessThan(Number(full?.paddingX));
    expect(Number(compact?.label?.fontSize)).toBeLessThan(Number(full?.label?.fontSize));
  });
});

describe("axisLabelFontSize", () => {
  it("uses a smaller axis label on phones", () => {
    expect(axisLabelFontSize(true)).toBeLessThan(axisLabelFontSize(false));
  });
});
