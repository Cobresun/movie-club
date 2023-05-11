import { AgScatterSeriesTooltipRendererParams } from "ag-charts-community";

export const normalizeArray = (array: number[]) => {
  let sum = 0;
  let count = 0;

  for (let i = 0; i < array.length; i++) {
    if (array[i] === undefined) count++;
    else sum += array[i];
  }

  const mean: number = sum / (array.length - count);
  const cleanArray: number[] = array.map((score) => {
    return score === undefined ? mean : score; // default to mean if score missing
  });
  const variance =
    cleanArray.reduce((s, n) => s + (n - mean) ** 2, 0) /
    (cleanArray.length - 1);
  const std = Math.sqrt(variance);
  const normArray: number[] = cleanArray.map((x) => (x - mean) / std);
  const stdCorrectedArray: number[] = normArray.map(
    (x) => Math.round((x / std) * 100) / 100
  );

  if (array.length == count || std == 0) {
    // no reviews for user
    return array.map(() => 0);
  }
  return stdCorrectedArray;
};

export interface chartOptionParamTypes {
  chartTitle: string;
  chartType?: string;
  xName: string;
  xData: string;
  yName: string;
  yData: string;
  normalizeX?: boolean;
  normalizeY?: boolean;
  normalizeToggled?: boolean;
  movieData: any[];
}

export const loadDefaultChartSettings = ({
  chartTitle,
  chartType = "scatter",
  xName,
  xData,
  yName,
  yData,
  normalizeX = false,
  normalizeY = false,
  normalizeToggled = false,
  movieData,
}: chartOptionParamTypes) => {
  return {
    autoSize: true,
    theme: "ag-default-dark",
    title: {
      text: chartTitle,
    },
    data: movieData,
    series: [
      {
        type: chartType,
        xKey: xData + (normalizeX && normalizeToggled ? "Norm" : ""),
        xName: xName,
        yKey: yData + (normalizeY && normalizeToggled ? "Norm" : ""),
        yName: yName,
        showInLegend: false,
        tooltip: {
          renderer: function (params: AgScatterSeriesTooltipRendererParams) {
            return (
              '<div class="ag-chart-tooltip-title" ' +
              'style="background-color:' +
              params.color +
              '">' +
              params.datum.movieTitle +
              "</div>" +
              '<div class="ag-chart-tooltip-content">' +
              params.xName +
              ": " +
              params.xValue +
              "</br>" +
              params.yName +
              ": " +
              params.yValue +
              "</div>"
            );
          },
        },
      },
    ],
    axes: [
      {
        type: "number",
        position: "bottom",
        title: {
          enabled: true,
          text: xName,
        },
      },
      {
        type: "number",
        position: "left",
        title: {
          enabled: true,
          text: yName,
        },
      },
    ],
  };
};
