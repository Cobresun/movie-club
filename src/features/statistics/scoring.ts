import type {
  AgBarSeriesTooltipRendererParams,
  AgCartesianChartOptions,
  AgLineSeriesTooltipRendererParams,
} from "ag-charts-community";

import type {
  DecadeStats,
  HistogramData,
  ScoreTrendPoint,
  ScoreVariancePoint,
  WorkStatsData,
} from "./types";
import { isDefined } from "../../../lib/checks/checks.js";
import { Member } from "../../../lib/types/club";

export const createHistogramData = (scores: number[]): HistogramData[] => {
  if (scores.length === 0) return [];

  const bins: HistogramData[] = Array.from({ length: 11 }, (_, i) => ({
    bin: i,
    ...Object.fromEntries(scores.map((_, index) => [index, 0])),
  }));
  return bins;
};

export interface HistogramChartParams {
  filteredWorkData: WorkStatsData[];
  histogramData: HistogramData[];
  members: Member[];
}

export function createHistogramOptions(
  params: HistogramChartParams,
): AgCartesianChartOptions {
  const { filteredWorkData, histogramData, members } = params;

  const filteredHistData = histogramData.map((bin) => {
    const filtered = { ...bin };
    members.forEach((member) => {
      filtered[member.id] = 0;
    });
    return filtered;
  });

  filteredWorkData.forEach((movie) => {
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

export function createScoreVarianceChartOptions(
  variancePoints: ScoreVariancePoint[],
): AgCartesianChartOptions {
  const stroke = "#A78BFA";

  return {
    theme: "ag-default-dark",
    background: { visible: false },
    data: variancePoints,
    series: [
      {
        type: "line" as const,
        xKey: "date",
        xName: "Date",
        yKey: "rollingStdDev",
        yName: "Score Spread",
        strokeWidth: 2.5,
        stroke,
        marker: {
          size: 4,
          fill: stroke,
        },
        interpolation: { type: "smooth" as const },
        tooltip: {
          renderer: function (
            params: AgLineSeriesTooltipRendererParams<ScoreVariancePoint>,
          ) {
            return (
              `<div class="ag-chart-tooltip-title" style="background-color: ${stroke}">${params.datum.movieTitle}</div>` +
              `<div class="ag-chart-tooltip-content">` +
              `Movie spread: ${params.datum.movieStdDev.toFixed(2)}` +
              `<br/>Rolling spread: ${params.datum.rollingStdDev.toFixed(2)}` +
              `</div>`
            );
          },
        },
      },
    ],
    axes: [
      {
        type: "time",
        position: "bottom",
        label: {
          format: "%b %Y",
        },
      },
      {
        type: "number",
        position: "left",
        min: 0,
        nice: true,
        title: {
          enabled: true,
          text: "Score Spread (std dev)",
        },
      },
    ],
    legend: {
      enabled: false,
    },
  };
}

const TREND_COLORS = [
  "#2196F3",
  "#4CAF50",
  "#FF9800",
  "#E91E63",
  "#9C27B0",
  "#00BCD4",
  "#FF5722",
  "#8BC34A",
];

export function createScoreTrendChartOptions(
  trendData: Map<string, ScoreTrendPoint[]>,
  members: Member[],
): AgCartesianChartOptions {
  const allAverages = [...trendData.values()].flatMap((points) =>
    points.map((p) => p.rollingAverage),
  );
  const dataMin = allAverages.length > 0 ? Math.min(...allAverages) : 0;
  const yMin = Math.max(0, Math.floor(dataMin) - 1);

  const series = members
    .filter((member) => trendData.has(member.id))
    .map((member, index) => ({
      type: "line" as const,
      data: trendData.get(member.id),
      xKey: "date",
      xName: "Date",
      yKey: "rollingAverage",
      yName: member.name,
      strokeWidth: 2.5,
      stroke: TREND_COLORS[index % TREND_COLORS.length],
      marker: {
        size: 4,
        fill: TREND_COLORS[index % TREND_COLORS.length],
      },
      interpolation: { type: "smooth" as const },
      tooltip: {
        renderer: function (
          params: AgLineSeriesTooltipRendererParams<ScoreTrendPoint>,
        ) {
          const color = TREND_COLORS[index % TREND_COLORS.length];
          return (
            `<div class="ag-chart-tooltip-title" style="background-color: ${color}">${member.name}</div>` +
            `<div class="ag-chart-tooltip-content">` +
            `${params.datum.movieTitle}` +
            `<br/>Score: ${params.datum.actualScore}` +
            `<br/>Rolling Avg: ${params.datum.rollingAverage}` +
            `</div>`
          );
        },
      },
    }));

  return {
    theme: "ag-default-dark",
    background: { visible: false },
    series,
    axes: [
      {
        type: "time",
        position: "bottom",
        label: {
          format: "%b %Y",
        },
      },
      {
        type: "number",
        position: "left",
        nice: false,
        min: yMin,
        max: 10,
        title: {
          enabled: true,
          text: "Rolling Avg Score",
        },
      },
    ],
    legend: {
      position: "bottom",
    },
  };
}
