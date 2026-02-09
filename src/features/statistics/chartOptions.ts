import {
  AgBarSeriesTooltipRendererParams,
  AgCartesianChartOptions,
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
