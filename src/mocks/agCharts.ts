import type { AgChartOptions } from "ag-charts-community";
import { defineComponent, ref, watchEffect, h, type PropType } from "vue";

import { ensure } from "@/../lib/checks/checks";

/**
 * Stand-in for `<ag-charts>` from `ag-charts-vue3`.
 *
 * AG Charts paints into a `<canvas>`, and jsdom provides no 2D context — the
 * real component throws while building its scene and again on unmount. Widget
 * tests care that a chart is rendered and that it is reconfigured when the user
 * changes mode, not that pixels are drawn; the option builders themselves are
 * covered directly by `chartOptions.spec.ts`.
 *
 * Opt in per spec file (mirroring `mockIntersectionObserver`) with:
 *
 * ```ts
 * vi.mock("ag-charts-vue3", async () => await import("@/mocks/agCharts"));
 * ```
 *
 * The dynamic import matters: `vi.mock` is hoisted above the file's imports, so
 * a factory that referenced a statically-imported stub would hit a TDZ error.
 */
const SERIES_AREA_CLASS = "ag-charts-series-area";

export const AgCharts = defineComponent({
  name: "AgCharts",
  props: {
    options: { type: Object as PropType<AgChartOptions>, required: true },
  },
  setup(props) {
    const element = ref<Element | null>(null);
    // Re-runs whenever the element mounts or the options are rebuilt, so the
    // recorded options always match what the widget most recently passed.
    // Sync flush: tests read the options straight after `render()` / `click()`,
    // before Vue's default pre-flush queue would have run.
    watchEffect(
      () => {
        if (element.value !== null) OPTIONS.set(element.value, props.options);
      },
      { flush: "sync" },
    );
    return () =>
      h("div", { ref: element, role: "img", "aria-label": "chart" }, [
        // The element the real component attaches its pointer listeners to.
        h("div", { class: SERIES_AREA_CLASS }),
      ]);
  },
});

const OPTIONS = new WeakMap<Element, AgChartOptions>();

/** The options a stubbed chart element was last rendered with. */
export function chartOptions(element: Element): AgChartOptions {
  return ensure(OPTIONS.get(element), "element was not rendered by the ag-charts stub");
}

interface KeyedSeries {
  yKey: string;
  yName?: string;
}

function isKeyedSeries(series: unknown): series is KeyedSeries {
  return typeof series === "object" && series !== null && "yKey" in series;
}

/**
 * The `yName ?? yKey` of each plotted series, in order — enough to tell one
 * chart configuration from another (which is what mode-switching tests assert)
 * without duplicating chartOptions.spec.ts's detailed option checks.
 *
 * ag-charts types `series` as a wide union whose members don't all carry a
 * `yKey`, and the codebase forbids `as` casts, so narrowing happens at runtime
 * (the convention noted in testing.md).
 */
export function chartSeriesNames(element: Element): string[] {
  const series: unknown[] = chartOptions(element).series ?? [];
  return series.filter(isKeyedSeries).map((one) => one.yName ?? one.yKey);
}

/**
 * The element AG Charts listens on for the pointer leaving a chart — dismissing
 * a tooltip means getting a `mouseleave` to it.
 */
export function chartSeriesArea(element: Element): Element {
  return ensure(
    element.querySelector(`.${SERIES_AREA_CLASS}`),
    "element was not rendered by the ag-charts stub",
  );
}
