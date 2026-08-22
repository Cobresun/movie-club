import { CLUB_SERIES_COLOR, MEMBER_SERIES_COLORS, memberSeriesColor } from "@/common/chartPalette";

/**
 * The palette is the statistics page's single source of chart-color truth
 * (#412). The property that matters is that a member keeps one colour across
 * every chart on the page, however many members the club has.
 *
 * The sizes and paddings the module also exports are styling; they belong to
 * whoever is tuning the charts, not to a test that would have to change with
 * every adjustment.
 */
describe("memberSeriesColor", () => {
  it("gives each member their own slot, in fixed order", () => {
    const colors = MEMBER_SERIES_COLORS.map((_, index) => memberSeriesColor(index));

    expect(colors).toEqual([...MEMBER_SERIES_COLORS]);
    expect(new Set(colors).size).toBe(colors.length);
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
