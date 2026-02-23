import type {
  AgBarSeriesTooltipRendererParams,
  AgCartesianChartOptions,
} from "ag-charts-community";

import type { DecadeStats, HistogramData, MovieData } from "./types";
import { isDefined } from "../../../lib/checks/checks.js";
import { Member } from "../../../lib/types/club";

/**
 * Normalizes an array of numbers (with possible undefined gaps) by subtracting
 * the mean and dividing by the standard deviation. Undefined positions are
 * preserved in the output.
 */
export const normalizeArray = (
  array: (number | undefined)[],
): (number | undefined)[] => {
  if (array.length === 0) return [];

  const defined = array.filter(isDefined);

  if (defined.length <= 1) {
    return array.map((v) => (isDefined(v) ? 0 : undefined));
  }

  const sum = defined.reduce((acc, score) => acc + score, 0);
  const mean = sum / defined.length;
  const variance =
    defined.reduce((acc, score) => acc + Math.pow(score - mean, 2), 0) /
    (defined.length - 1);
  const std = Math.sqrt(variance);

  if (std === 0) {
    return array.map((v) => (isDefined(v) ? 0 : undefined));
  }

  return array.map((score) => {
    if (!isDefined(score)) return undefined;
    return parseFloat(((score - mean) / std).toFixed(2));
  });
};

export const createHistogramData = (scores: number[]): HistogramData[] => {
  if (scores.length === 0) return [];

  const bins: HistogramData[] = Array.from({ length: 11 }, (_, i) => ({
    bin: i,
    ...Object.fromEntries(scores.map((_, index) => [index, 0])),
  }));
  return bins;
};

/**
 * Maps a z-score to a background color for the score context heat map.
 * Positive z-scores (above member's average) -> green.
 * Negative z-scores (below member's average) -> red.
 * Near zero -> transparent.
 */
export function getScoreContextColor(zScore: number | undefined): string {
  if (zScore === undefined || isNaN(zScore)) return "transparent";

  const deadZone = 0.1;
  if (Math.abs(zScore) < deadZone) return "transparent";

  const maxOpacity = 0.45;
  const opacity = Math.min(Math.abs(zScore) / 2.0, 1.0) * maxOpacity;

  if (zScore > 0) {
    return `rgba(34, 197, 94, ${opacity.toFixed(2)})`;
  }
  return `rgba(239, 68, 68, ${opacity.toFixed(2)})`;
}

export interface HistogramChartParams {
  filteredMovieData: MovieData[];
  histogramData: HistogramData[];
  members: Member[];
}

export function createHistogramOptions(
  params: HistogramChartParams,
): AgCartesianChartOptions {
  const { filteredMovieData, histogramData, members } = params;

  const filteredHistData = histogramData.map((bin) => {
    const filtered = { ...bin };
    members.forEach((member) => {
      filtered[member.id] = 0;
    });
    return filtered;
  });

  filteredMovieData.forEach((movie) => {
    members.forEach((member) => {
      const rawScore = movie.userScores[member.id];
      if (!isDefined(rawScore)) return;
      const score = Math.floor(rawScore);
      if (!isNaN(score)) {
        filteredHistData[score][member.id] += 1;
      }
    });
  });

  return {
    theme: "ag-default-dark",
    background: { visible: false },
    data: filteredHistData,
    series: members.map((member) => {
      return {
        type: "bar" as const,
        direction: "vertical" as const,
        grouped: true,
        cornerRadius: 2,
        xKey: "bin",
        xName: "Score",
        yKey: member.id,
        yName: member.name,
        showInLegend: true,
        tooltip: {
          renderer: function (
            params: AgBarSeriesTooltipRendererParams<HistogramData>,
          ) {
            const name = members.find((m) => m.id === params.yKey)?.name;
            return (
              `<div class="ag-chart-tooltip-title">${name}</div>` +
              `<div class="ag-chart-tooltip-content">` +
              `${params.xName}: ${params.datum.bin}` +
              `</br>` +
              `${params.yName}: ${params.datum[member.id]}` +
              `</div>`
            );
          },
        },
      };
    }),
    axes: [
      {
        type: "category",
        position: "bottom",
        title: {
          enabled: true,
          text: "Score",
        },
      },
      {
        type: "number",
        position: "left",
        title: {
          enabled: true,
          text: "Frequency",
        },
      },
    ],
  };
}

export function createDecadeChartOptions(
  decadeStats: DecadeStats[],
): AgCartesianChartOptions {
  return {
    theme: "ag-default-dark",
    background: { visible: false },
    data: decadeStats,
    series: [
      {
        type: "bar" as const,
        direction: "vertical" as const,
        xKey: "decade",
        xName: "Decade",
        yKey: "averageScore",
        yName: "Avg Score",
        cornerRadius: 4,
        tooltip: {
          renderer: function (
            params: AgBarSeriesTooltipRendererParams<DecadeStats>,
          ) {
            return (
              `<div class="ag-chart-tooltip-title">${params.datum.decade}</div>` +
              `<div class="ag-chart-tooltip-content">` +
              `Avg Score: ${params.datum.averageScore}` +
              `<br/>` +
              `Movies: ${params.datum.count}` +
              `</div>`
            );
          },
        },
      },
    ],
    axes: [
      {
        type: "category",
        position: "bottom",
      },
      {
        type: "number",
        position: "left",
        min: 0,
        max: 10,
        title: {
          enabled: true,
          text: "Average Score",
        },
      },
    ],
  };
}
