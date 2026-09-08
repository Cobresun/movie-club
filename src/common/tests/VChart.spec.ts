import { screen } from "@testing-library/vue";

import VChart from "../components/VChart.vue";
import { chartSeriesArea } from "@/mocks/agCharts";
import { render } from "@/tests/utils";

vi.mock("ag-charts-vue3", async () => await import("@/mocks/agCharts"));

const props = { options: { series: [] } };

const listenForDismissal = () => {
  const dismissed = vi.fn();
  chartSeriesArea(screen.getByRole("img", { name: "chart" })).addEventListener(
    "mouseleave",
    dismissed,
  );
  return dismissed;
};

describe("VChart", () => {
  it("takes the pointer off the chart when the page scrolls, closing a tapped tooltip", () => {
    render(VChart, { props });
    const dismissed = listenForDismissal();

    window.dispatchEvent(new Event("scroll"));

    expect(dismissed).toHaveBeenCalled();
  });

  it("stops listening once unmounted", () => {
    const chart = render(VChart, { props });
    const dismissed = listenForDismissal();

    chart.unmount();
    window.dispatchEvent(new Event("scroll"));

    expect(dismissed).not.toHaveBeenCalled();
  });
});
