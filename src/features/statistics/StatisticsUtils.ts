import {
  AgCartesianChartOptions,
  AgScatterSeriesTooltipRendererParams,
} from "ag-charts-community";

import { isDefined } from "../../../lib/checks/checks.js";
import { WorkType } from "../../../lib/types/generated/db.js";
import { DetailedReviewListItem } from "../../../lib/types/lists.js";
import { DetailedMovieData } from "../../../lib/types/movie.js";

/**
 * Normalizes an array of numbers by subtracting the mean and dividing by the standard deviation.
 * Replaces undefined values with the mean.
 * @param array - The array of numbers to normalize.
 * @returns A normalized array of numbers.
 */
export const normalizeArray = (array: number[]): number[] => {
  if (array.length === 0) return [];

  const validScores = array.filter((score) => score !== undefined);
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

  return array.map((score) => {
    const value = score === undefined ? mean : score;
    return parseFloat(((value - mean) / std).toFixed(2));
  });
};

// TODO: This type should just be a Review plus computed fields. No reason to spread external data to this type
export interface MovieStatistics extends DetailedReviewListItem {
  id: string;
  type: WorkType.movie;
  title: string;
  createdDate: string;
  imageUrl: string | undefined;
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
  userScores: Record<string, number>;
  normalized: Record<string, number>;
  externalData: DetailedMovieData;
  dateWatched: string;
}

export type NumericMovieStatisticsKeys = {
  [K in keyof MovieStatistics]: MovieStatistics[K] extends number | undefined
    ? K
    : never;
}[keyof MovieStatistics];

export type HistogramData = {
  bin: number;
  [index: string]: number;
};

export const createHistogramData = (scores: number[], normalized: boolean) => {
  if (scores.length === 0) return [];

  const bins = Array.from({ length: 11 }, (_, i) => ({
    bin: normalized ? i / 4.0 - 1.25 : i, // TODO: stop using hardcoded bin for std, this works for clubs with 4 members
    ...Object.fromEntries(scores.map((_, index) => [index, 0])),
  }));
  return bins;
};

export const loadScatterChartSettings = (params: {
  chartTitle: string;
  xName: string;
  xData: NumericMovieStatisticsKeys;
  yName: string;
  yData: NumericMovieStatisticsKeys;
  normalizeX: boolean;
  normalizeY: boolean;
  normalizeToggled: boolean;
  movieData: MovieStatistics[];
  chartType?: string;
}): AgCartesianChartOptions => {
  if (!isDefined(params.xData) || !isDefined(params.yData)) {
    throw new Error("xData and yData must be defined");
  }

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

  const data = movieData.map((movie) => ({
    xData:
      normalizeX && normalizeToggled ? movie.normalized[xData] : movie[xData],
    yData:
      normalizeY && normalizeToggled ? movie.normalized[yData] : movie[yData],
    title: movie.title,
  }));

  return {
    theme: "ag-default-dark",
    title: { text: chartTitle },
    data: data,
    series: [
      {
        type: "scatter",
        xKey: "xData",
        xName,
        yKey: "yData",
        yName,
        showInLegend: false,
        tooltip: {
          renderer: (
            params: AgScatterSeriesTooltipRendererParams<{
              xData: number;
              yData: number;
              title: string;
            }>,
          ) => {
            const fillColor = typeof params.fill === "string" ? params.fill : "";
            return (
              `<div class="ag-chart-tooltip-title p-2" style="background-color:${fillColor}">${params.datum.title}</div>` +
              `<div class="ag-chart-tooltip-content p-2 text-start">${xName}: ${params.datum.xData}<br/>${yName}: ${params.datum.yData}</div>`
            );
          },
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
