import { isDefined } from "../../../lib/checks/checks.js";
import { Member } from "../../../lib/types/club.js";
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

export type HistogramData = {
  bin: number;
  [index: string]: number;
};

export const createHistogramData = (scores: number[]) => {
  if (scores.length === 0) return [];

  const bins = Array.from({ length: 11 }, (_, i) => ({
    bin: i,
    ...Object.fromEntries(scores.map((_, index) => [index, 0])),
  }));
  return bins;
};

/**
 * Maps a z-score to a background color for the score context heat map.
 * Positive z-scores (above member's average) → green.
 * Negative z-scores (below member's average) → red.
 * Near zero → transparent.
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

export interface GenreStats {
  genre: string;
  averageScore: number;
  count: number;
}

const MIN_GENRE_COUNT = 2;

export function computeGenreStats(
  movieData: MovieStatistics[],
  memberId?: string,
): {
  mostLoved: GenreStats[];
  leastLoved: GenreStats[];
} {
  const genreScores: Record<string, { count: number; totalScore: number }> = {};

  for (const movie of movieData) {
    const score = isDefined(memberId)
      ? movie.userScores[memberId]
      : movie.average;
    if (!isDefined(score) || score === 0) continue;
    for (const genre of movie.genres) {
      const existing = genreScores[genre];
      if (isDefined(existing)) {
        existing.count++;
        existing.totalScore += score;
      } else {
        genreScores[genre] = { count: 1, totalScore: score };
      }
    }
  }

  const allGenres = Object.entries(genreScores)
    .filter(([, data]) => data.count >= MIN_GENRE_COUNT)
    .map(([genre, data]) => ({
      genre,
      averageScore: Math.round((data.totalScore / data.count) * 100) / 100,
      count: data.count,
    }));

  const sorted = [...allGenres].sort((a, b) => b.averageScore - a.averageScore);

  return {
    mostLoved: sorted.slice(0, 3),
    leastLoved: sorted
      .slice(-3)
      .sort((a, b) => a.averageScore - b.averageScore),
  };
}

export interface MemberLeaderboardEntry {
  member: Member;
  averageScore: number;
  reviewCount: number;
  title?: string;
}

export interface MovieAgreement {
  title: string;
  imageUrl: string | undefined;
  scoreA: number;
  scoreB: number;
  difference: number;
}

export interface MemberPairSimilarity {
  memberA: Member;
  memberB: Member;
  similarityPercent: number;
  avgDifference: number;
  sharedCount: number;
  bestAgreements: MovieAgreement[];
  worstAgreements: MovieAgreement[];
}

const MIN_SHARED_REVIEWS = 3;

export function computeTasteSimilarity(
  movieData: MovieStatistics[],
  members: Member[],
): {
  mostSimilar: MemberPairSimilarity | null;
  leastSimilar: MemberPairSimilarity | null;
} {
  if (members.length < 2) {
    return { mostSimilar: null, leastSimilar: null };
  }

  const pairs: MemberPairSimilarity[] = [];

  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      const memberA = members[i];
      const memberB = members[j];

      const sharedMovies: {
        title: string;
        imageUrl: string | undefined;
        scoreA: number;
        scoreB: number;
      }[] = [];

      for (const movie of movieData) {
        const scoreA = movie.userScores[memberA.id];
        const scoreB = movie.userScores[memberB.id];
        if (
          isDefined(scoreA) &&
          !isNaN(scoreA) &&
          isDefined(scoreB) &&
          !isNaN(scoreB)
        ) {
          sharedMovies.push({
            title: movie.title,
            imageUrl: movie.imageUrl,
            scoreA,
            scoreB,
          });
        }
      }

      if (sharedMovies.length < MIN_SHARED_REVIEWS) continue;

      const totalDiff = sharedMovies.reduce(
        (sum, m) => sum + Math.abs(m.scoreA - m.scoreB),
        0,
      );
      const avgDifference =
        Math.round((totalDiff / sharedMovies.length) * 100) / 100;
      const similarityPercent =
        Math.round((1 - avgDifference / 10) * 10000) / 100;

      const withDiffs = sharedMovies.map((m) => ({
        ...m,
        difference: Math.abs(m.scoreA - m.scoreB),
      }));
      const sorted = [...withDiffs].sort((a, b) => a.difference - b.difference);

      pairs.push({
        memberA,
        memberB,
        similarityPercent,
        avgDifference,
        sharedCount: sharedMovies.length,
        bestAgreements: sorted.slice(0, 3),
        worstAgreements: sorted
          .slice(-3)
          .sort((a, b) => b.difference - a.difference),
      });
    }
  }

  if (pairs.length === 0) {
    return { mostSimilar: null, leastSimilar: null };
  }

  const sortedPairs = [...pairs].sort(
    (a, b) => b.similarityPercent - a.similarityPercent,
  );

  return {
    mostSimilar: sortedPairs[0],
    leastSimilar: sortedPairs[sortedPairs.length - 1],
  };
}

export function computeMemberLeaderboard(
  movieData: MovieStatistics[],
  members: Member[],
): MemberLeaderboardEntry[] {
  const entries: MemberLeaderboardEntry[] = members.map((member) => {
    const scores = movieData
      .map((movie) => movie.userScores[member.id])
      .filter((score) => isDefined(score) && !isNaN(score));

    const averageScore =
      scores.length > 0
        ? Math.round(
            (scores.reduce((a, b) => a + b, 0) / scores.length) * 100,
          ) / 100
        : 0;

    return { member, averageScore, reviewCount: scores.length };
  });

  const ranked = entries
    .filter((e) => e.reviewCount > 0)
    .sort((a, b) => b.averageScore - a.averageScore);

  if (ranked.length > 0) {
    ranked[0].title = "The Softie";
    ranked[ranked.length - 1].title = "The Hater";
  }

  return ranked;
}
