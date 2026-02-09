import {
  AgCartesianChartOptions,
  AgLineSeriesTooltipRendererParams,
} from "ag-charts-community";

import { HistogramData, MovieStatistics } from "./StatisticsUtils";
import { Member } from "../../../lib/types/club";

export interface HistogramChartParams {
  filteredMovieData: MovieStatistics[];
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
      const score = Math.floor(movie.userScores[member.id]);
      if (!isNaN(score)) {
        filteredHistData[score][member.id] += 1;
      }
    });
  });

  return {
    theme: "ag-default-dark",
    title: { text: "Score Histogram" },
    data: filteredHistData,
    series: members.map((member) => {
      return {
        type: "line" as const,
        xKey: "bin",
        xName: "Score",
        yKey: member.id,
        yName: member.name,
        showInLegend: true,
        tooltip: {
          renderer: function (
            params: AgLineSeriesTooltipRendererParams<HistogramData>,
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
        type: "number",
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
          text: "Frequency of Score",
        },
      },
    ],
  };
}
