import { AgScatterSeriesTooltipRendererParams } from "ag-charts-community";

/**
 * Normalizes an array of numbers by subtracting the mean and dividing by the standard deviation.
 * Replaces undefined values with the mean.
 * @param array - The array of numbers to normalize.
 * @returns A normalized array of numbers.
 */
export const normalizeArray = (array: number[]): number[] => {
  if (!array?.length) return [];

  const validScores = array.filter(score => score !== undefined);
  const count = validScores.length;

  if (count === 0) {
    return array.map(() => 0);
  }

  const sum = validScores.reduce((acc, score) => acc + score, 0);
  const mean = sum / count;
  const variance =
    validScores.reduce((acc, score) => acc + Math.pow(score - mean, 2), 0) /
    (count - 1);
  const std = Math.sqrt(variance);

  if (std === 0) {
    return array.map(() => 0);
  }

  return array.map(score => {
    const value = score === undefined ? mean : score;
    return parseFloat(((value - mean) / std).toFixed(2));
  });
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

export interface ChartTitle {
  text: string;
}

export interface ChartAxis {
  type: string;
  position: string;
  title: {
    enabled: boolean;
    text: string;
  };
}

export interface ChartSeries {
  type: string;
  xKey: string;
  xName: string;
  yKey: string;
  yName: string;
  showInLegend: boolean;
  tooltip: {
    renderer: (params: any) => string;
  };
}

export interface ChartConfig {
  autoSize: boolean;
  theme: string;
  title: ChartTitle;
  data: MovieStatistics[];
  series: ChartSeries[];
  axes: ChartAxis[];
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

export const loadDefaultChartSettings = (params: {
  chartTitle: string;
  xName: string;
  xData: string;
  yName: string;
  yData: string;
  normalizeX: boolean;
  normalizeY: boolean;
  normalizeToggled: boolean;
  movieData: MovieStatistics[];
  chartType?: string;
}): ChartConfig => {
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
    chartType = "scatter",
  } = params;

  const finalXKey = xData + (normalizeX && normalizeToggled ? "Norm" : "");
  const finalYKey = yData + (normalizeY && normalizeToggled ? "Norm" : "");

  return {
    autoSize: true,
    theme: "ag-default-dark",
    title: { text: chartTitle },
    data: movieData,
    series: [
      {
        type: chartType,
        xKey: finalXKey,
        xName,
        yKey: finalYKey,
        yName,
        showInLegend: false,
        tooltip: {
          renderer: (params: AgScatterSeriesTooltipRendererParams) =>
            `<div class="ag-chart-tooltip-title" style="background-color:${params.color}">${params.datum.movieTitle}</div>` +
            `<div class="ag-chart-tooltip-content">${params.xName}: ${params.xValue}<br/>${params.yName}: ${params.yValue}</div>`,
        },
      },
    ],
    axes: [
      {
        type: "number",
        position: "bottom",
        title: { enabled: true, text: xName },
      },
      {
        type: "number",
        position: "left",
        title: { enabled: true, text: yName },
      },
    ],
  };
};
