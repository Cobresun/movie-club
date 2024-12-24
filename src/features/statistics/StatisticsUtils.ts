import { AgScatterSeriesTooltipRendererParams } from "ag-charts-community";

// Normalizes an array of scores by subtracting the mean and dividing by the standard deviation,
// Allows us to compare scores from different members accounting for the variance in their scores
export const normalizeArray = (array: number[]) => {
  if (!array?.length) return [];
  
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
    (x) => Math.round((x / std) * 100) / 100,
  );

  if (array.length == count || std == 0) {
    // no reviews for user
    return array.map(() => 0);
  }
  return stdCorrectedArray;
};

export interface MovieStatistics {
  movieTitle: string;
  dateWatched: string;
  vote_average: number;
  revenue: number;
  budget: number;
  release_date: string | null;
  release_year?: number;
  revenueMil?: number;
  budgetMil?: number;
  genres: string[];
  production_companies: string[];
  production_countries: string[];
  average: number;
  averageNorm?: number;
  vote_averageNorm?: number;
  [key: string]: any; // For dynamic member scores
}

export interface ChartOptions {
  autoSize: boolean;
  theme: string;
  title: { text: string };
  data: MovieStatistics[];
  series: any[];
  axes: any[];
}

export const createHistogramData = (scores: number[], normalized: boolean) => {
  if (!scores?.length) return [];
  
  const bins = Array.from({ length: 11 }, (_, i) => ({
    bin: normalized ? i / 4.0 - 1.25 : i, // TODO: stop using hardcoded bin for std, this works for clubs with 4 members
    ...Object.fromEntries(scores.map((_, index) => [index, 0])),
  }));
  return bins;
};

export const baseChartConfig = {
  autoSize: true,
  theme: "ag-default-dark",
  axes: [
    {
      type: "number",
      position: "bottom",
      title: { enabled: true },
    },
    {
      type: "number",
      position: "left",
      title: { enabled: true },
    },
  ],
};

export const loadDefaultChartSettings = (params: chartOptionParamTypes) => {
  const {
    chartTitle,
    xName,
    xData,
    yName,
    yData,
    normalizeX,
    normalizeY,
    normalizeToggled,
    movieData,
  } = params;

  return {
    ...baseChartConfig,
    title: { text: chartTitle },
    data: movieData,
    series: [
      {
        type: params.chartType ?? "scatter",
        xKey: xData + (normalizeX && normalizeToggled ? "Norm" : ""),
        xName,
        yKey: yData + (normalizeY && normalizeToggled ? "Norm" : ""),
        yName,
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
        ...baseChartConfig.axes[0],
        title: { ...baseChartConfig.axes[0].title, text: xName },
      },
      {
        ...baseChartConfig.axes[1],
        title: { ...baseChartConfig.axes[1].title, text: yName },
      },
    ],
  };
};
