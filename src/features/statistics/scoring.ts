import type {
  AgBarSeriesTooltipRendererParams,
  AgCartesianChartOptions,
  AgLineSeriesTooltipRendererParams,
} from "ag-charts-community";

import { isDefined } from "../../../lib/checks/checks.js";
import { Member } from "../../../lib/types/club";
import {
  axisLabelFontSize,
  baseChartOptions,
  baseLegendOptions,
  CHART_SURFACE,
  CLUB_SERIES_COLOR,
  memberSeriesColor,
} from "./chartPalette";
import type {
  CumulativeCountPoint,
  DecadeStats,
  HistogramData,
  MonthlyActivityPoint,
  ScoreTrendPoint,
  ScoreVariancePoint,
  WorkStatsData,
} from "./types";

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
  compact: boolean;
}

export function createHistogramOptions(params: HistogramChartParams): AgCartesianChartOptions {
  const { filteredWorkData, histogramData, members, compact } = params;

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
    ...baseChartOptions(compact),
    data: filteredHistData,
    // Stacked (not grouped) bars: one readable column per score bin however
    // many members the club has — grouped slivers were unreadable on phones.
    series: members.map((member, index) => {
      const fill = memberSeriesColor(index);
      return {
        type: "bar" as const,
        direction: "vertical" as const,
        stacked: true,
        xKey: "bin",
        xName: "Score",
        yKey: member.id,
        yName: member.name,
        fill,
        // Surface-colored seam keeps touching stack segments separable.
        stroke: CHART_SURFACE,
        strokeWidth: 1,
        showInLegend: true,
        tooltip: {
          renderer: function (params: AgBarSeriesTooltipRendererParams<HistogramData>) {
            return (
              `<div class="ag-chart-tooltip-title" style="background-color: ${fill}">${member.name}</div>` +
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
        label: { fontSize: axisLabelFontSize(compact) },
        title: { enabled: !compact, text: "Score" },
      },
      {
        type: "number",
        position: "left",
        label: { fontSize: axisLabelFontSize(compact) },
        title: { enabled: !compact, text: "Reviews" },
      },
    ],
    legend: baseLegendOptions(compact),
  };
}

export function createDecadeChartOptions(
  decadeStats: DecadeStats[],
  countLabel = "Movies",
  compact = false,
): AgCartesianChartOptions {
  return {
    ...baseChartOptions(compact),
    data: decadeStats,
    series: [
      {
        type: "bar" as const,
        direction: "vertical" as const,
        xKey: "decade",
        xName: "Decade",
        yKey: "averageScore",
        yName: "Avg Score",
        fill: CLUB_SERIES_COLOR,
        cornerRadius: 4,
        tooltip: {
          renderer: function (params: AgBarSeriesTooltipRendererParams<DecadeStats>) {
            return (
              `<div class="ag-chart-tooltip-title" style="background-color: ${CLUB_SERIES_COLOR}">${params.datum.decade}</div>` +
              `<div class="ag-chart-tooltip-content">` +
              `Avg Score: ${params.datum.averageScore}` +
              `<br/>` +
              `${countLabel}: ${params.datum.count}` +
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
        label: { fontSize: axisLabelFontSize(compact) },
      },
      {
        type: "number",
        position: "left",
        min: 0,
        max: 10,
        label: { fontSize: axisLabelFontSize(compact) },
        title: { enabled: !compact, text: "Average Score" },
      },
    ],
    legend: { enabled: false },
  };
}

export function createScoreVarianceChartOptions(
  variancePoints: ScoreVariancePoint[],
  compact = false,
): AgCartesianChartOptions {
  const stroke = CLUB_SERIES_COLOR;

  return {
    ...baseChartOptions(compact),
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
          renderer: function (params: AgLineSeriesTooltipRendererParams<ScoreVariancePoint>) {
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
          fontSize: axisLabelFontSize(compact),
        },
      },
      {
        type: "number",
        position: "left",
        min: 0,
        nice: true,
        label: { fontSize: axisLabelFontSize(compact) },
        title: { enabled: !compact, text: "Score Spread (std dev)" },
      },
    ],
    legend: {
      enabled: false,
    },
  };
}

export function createScoreTrendChartOptions(
  trendData: Map<string, ScoreTrendPoint[]>,
  members: Member[],
  compact = false,
): AgCartesianChartOptions {
  const allAverages = [...trendData.values()].flatMap((points) =>
    points.map((p) => p.rollingAverage),
  );
  const dataMin = allAverages.length > 0 ? Math.min(...allAverages) : 0;
  const yMin = Math.max(0, Math.floor(dataMin) - 1);

  // Color by position in the full member list (not the filtered one) so each
  // member wears the same color here as in the distribution chart.
  const series = members
    .map((member, memberIndex) => ({
      member,
      color: memberSeriesColor(memberIndex),
    }))
    .filter(({ member }) => trendData.has(member.id))
    .map(({ member, color }) => ({
      type: "line" as const,
      data: trendData.get(member.id),
      xKey: "date",
      xName: "Date",
      yKey: "rollingAverage",
      yName: member.name,
      strokeWidth: 2.5,
      stroke: color,
      marker: {
        size: 4,
        fill: color,
      },
      interpolation: { type: "smooth" as const },
      tooltip: {
        renderer: function (params: AgLineSeriesTooltipRendererParams<ScoreTrendPoint>) {
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
    ...baseChartOptions(compact),
    series,
    axes: [
      {
        type: "time",
        position: "bottom",
        label: {
          format: "%b %Y",
          fontSize: axisLabelFontSize(compact),
        },
      },
      {
        type: "number",
        position: "left",
        nice: false,
        min: yMin,
        max: 10,
        label: { fontSize: axisLabelFontSize(compact) },
        title: { enabled: !compact, text: "Rolling Avg Score" },
      },
    ],
    legend: baseLegendOptions(compact),
  };
}

export function createMonthlyActivityChartOptions(
  points: MonthlyActivityPoint[],
  countLabel: string,
  compact = false,
): AgCartesianChartOptions {
  return {
    ...baseChartOptions(compact),
    data: points,
    series: [
      {
        type: "bar" as const,
        direction: "vertical" as const,
        xKey: "month",
        xName: "Month",
        yKey: "count",
        yName: countLabel,
        fill: CLUB_SERIES_COLOR,
        cornerRadius: 2,
        tooltip: {
          renderer: function (params: AgBarSeriesTooltipRendererParams<MonthlyActivityPoint>) {
            return (
              `<div class="ag-chart-tooltip-title" style="background-color: ${CLUB_SERIES_COLOR}">${params.datum.label}</div>` +
              `<div class="ag-chart-tooltip-content">` +
              `${countLabel}: ${params.datum.count}` +
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
        nice: false,
        label: {
          format: "%b %Y",
          fontSize: axisLabelFontSize(compact),
        },
      },
      {
        type: "number",
        position: "left",
        label: { fontSize: axisLabelFontSize(compact) },
        title: { enabled: !compact, text: countLabel },
      },
    ],
    legend: { enabled: false },
  };
}

export function createCumulativeCountChartOptions(
  points: CumulativeCountPoint[],
  countLabel: string,
  compact = false,
): AgCartesianChartOptions {
  const stroke = CLUB_SERIES_COLOR;

  return {
    ...baseChartOptions(compact),
    data: points,
    series: [
      {
        type: "line" as const,
        xKey: "date",
        xName: "Date",
        yKey: "total",
        yName: countLabel,
        strokeWidth: 2.5,
        stroke,
        marker: { size: 4, fill: stroke },
        tooltip: {
          renderer: function (params: AgLineSeriesTooltipRendererParams<CumulativeCountPoint>) {
            return (
              `<div class="ag-chart-tooltip-title" style="background-color: ${stroke}">${params.datum.title}</div>` +
              `<div class="ag-chart-tooltip-content">` +
              `${countLabel}: ${params.datum.total}` +
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
          fontSize: axisLabelFontSize(compact),
        },
      },
      {
        type: "number",
        position: "left",
        min: 0,
        label: { fontSize: axisLabelFontSize(compact) },
        title: { enabled: !compact, text: countLabel },
      },
    ],
    legend: { enabled: false },
  };
}
