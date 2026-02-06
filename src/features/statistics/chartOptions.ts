import {
  AgBarSeriesTooltipRendererParams,
  AgCartesianChartOptions,
  AgLineSeriesTooltipRendererParams,
} from "ag-charts-community";

import {
  HistogramData,
  loadScatterChartSettings,
  MovieStatistics,
} from "./StatisticsUtils";
import { isDefined, isString } from "../../../lib/checks/checks.js";
import { Member } from "../../../lib/types/club";

export interface HistogramChartParams {
  filteredMovieData: MovieStatistics[];
  histogramData: HistogramData[];
  histogramNormData: HistogramData[];
  members: Member[];
  normalize: boolean;
}

export interface ScatterChartParams {
  filteredMovieData: MovieStatistics[];
  clubName: string;
  normalize: boolean;
}

export function createHistogramOptions(
  params: HistogramChartParams,
): AgCartesianChartOptions {
  const {
    filteredMovieData,
    histogramData,
    histogramNormData,
    members,
    normalize,
  } = params;

  // Filter the histogram data based on the filtered movies
  const filteredHistData = histogramData.map((bin) => {
    const filtered = { ...bin };
    members.forEach((member) => {
      filtered[member.id] = 0;
    });
    return filtered;
  });
  const filteredHistNormData = histogramNormData.map((bin) => {
    const filtered = { ...bin };
    members.forEach((member) => {
      filtered[member.id] = 0;
    });
    return filtered;
  });

  // Populate the filtered histogram data
  filteredMovieData.forEach((movie) => {
    members.forEach((member) => {
      const score = Math.floor(movie.userScores[member.id]);
      if (!isNaN(score)) {
        filteredHistData[score][member.id] += 1;
      }
      let scoreNorm = Math.floor(movie.normalized[member.id] * 4 + 5);
      scoreNorm = scoreNorm < 0 ? 0 : scoreNorm > 10 ? 10 : scoreNorm;
      filteredHistNormData[scoreNorm][member.id] += 1;
    });
  });

  return {
    theme: "ag-default-dark",
    title: { text: "Score Histogram" },
    data: normalize ? filteredHistNormData : filteredHistData,
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

export function createScoreVsTMDBOptions(
  params: ScatterChartParams,
): AgCartesianChartOptions {
  const { filteredMovieData, clubName, normalize } = params;

  const validTMDBData = filteredMovieData.filter(
    (movie) =>
      isDefined(movie.vote_average) &&
      !isString(movie.vote_average) &&
      movie.vote_average > 0 &&
      isDefined(movie.average) &&
      movie.average > 0,
  );

  return loadScatterChartSettings({
    chartTitle: "Score vs TMDB Audience Score",
    xName: "TMDB Audience Score",
    xData: "vote_average",
    normalizeX: true,
    yName: clubName + " Score",
    yData: "average",
    normalizeY: true,
    normalizeToggled: normalize,
    movieData: validTMDBData,
  });
}

export function createBudgetOptions(
  params: ScatterChartParams,
): AgCartesianChartOptions {
  return loadScatterChartSettings({
    chartTitle: "Score vs Film Budget (Millions)",
    xName: "Film Budget ($mil)",
    xData: "budgetMil",
    normalizeX: false,
    yName: params.clubName + " Score",
    yData: "average",
    normalizeY: true,
    normalizeToggled: params.normalize,
    movieData: params.filteredMovieData,
  });
}

export function createRevenueOptions(
  params: ScatterChartParams,
): AgCartesianChartOptions {
  return loadScatterChartSettings({
    chartTitle: "Score vs Film Revenue (Millions)",
    xName: "Film Revenue ($mil)",
    xData: "revenueMil",
    normalizeX: false,
    yName: params.clubName + " Score",
    yData: "average",
    normalizeY: true,
    normalizeToggled: params.normalize,
    movieData: params.filteredMovieData,
  });
}

export function createDateOptions(
  params: ScatterChartParams,
): AgCartesianChartOptions {
  return loadScatterChartSettings({
    chartTitle: "Score vs Release Date",
    xName: "Date",
    xData: "release_year",
    normalizeX: false,
    yName: params.clubName + " Score",
    yData: "average",
    normalizeY: true,
    normalizeToggled: params.normalize,
    movieData: params.filteredMovieData,
  });
}

export function createGenreOptions(
  movieData: MovieStatistics[],
): AgCartesianChartOptions {
  // Aggregate scores by genre
  const genreScores = movieData.reduce<
    Partial<Record<string, { count: number; totalScore: number }>>
  >((acc, movie) => {
    movie.genres.forEach((genre: string) => {
      if (movie.average !== 0) {
        let details = acc[genre];
        if (!details) {
          details = { count: 0, totalScore: 0 };
          acc[genre] = details;
        }
        details.count++;
        details.totalScore += movie.average ?? 0;
      }
    });
    return acc;
  }, {});

  const genreData = Object.entries(
    genreScores as Record<string, { count: number; totalScore: number }>,
  )
    .map(([genre, data]) => ({
      genre,
      averageScore: (data.totalScore ?? 0) / (data.count ?? 1),
      count: data.count ?? 0,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    theme: "ag-default-dark",
    title: { text: `Scores for Top 8 Genres` },
    data: genreData.slice(0, 8),
    series: [
      {
        type: "bar",
        xKey: "genre",
        xName: "Genre",
        yKey: "averageScore",
        yName: "Average Score",
        showInLegend: false,
        tooltip: {
          renderer: function (
            params: AgBarSeriesTooltipRendererParams<{
              genre: string;
              averageScore: number;
              count: number;
            }>,
          ) {
            return (
              `<div class="ag-chart-tooltip-title p-2" style="background-color:${String(params.fill)}">${params.datum.genre}</div>` +
              `<div class="ag-chart-tooltip-content p-2 text-start">` +
              `${params.xName}: ${params.datum.genre}` +
              `</br>` +
              `${params.yName}: ${params.datum.averageScore}` +
              "</br>" +
              `Count: ${params.datum.count}` +
              "</div>"
            );
          },
        },
      },
    ],
  };
}
