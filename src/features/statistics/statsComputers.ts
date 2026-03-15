import type {
  ClubConsensusEntry,
  DecadeStats,
  GenreStats,
  GenreWatchCount,
  GuiltyPleasureEntry,
  HeatmapDay,
  MemberLeaderboardEntry,
  MemberPairSimilarity,
  MovieData,
  ScoreTrendPoint,
  TmdbDeviationEntry,
  WatchingPaceStats,
} from "./types";
import {
  hasValue,
  isDefined,
  hasElements,
} from "../../../lib/checks/checks.js";
import { Member } from "../../../lib/types/club.js";

const MIN_GENRE_COUNT = 2;

export function computeGenreStats(
  movieData: MovieData[],
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
    if (!isDefined(score)) continue;
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

export function computeGenreWatchCounts(movieData: MovieData[]): {
  mostWatched: GenreWatchCount[];
  leastWatched: GenreWatchCount[];
} {
  const genreCounts: Record<string, number> = {};

  for (const movie of movieData) {
    for (const genre of movie.genres) {
      genreCounts[genre] = (genreCounts[genre] ?? 0) + 1;
    }
  }

  const sorted = Object.entries(genreCounts)
    .map(([genre, count]) => ({ genre, count }))
    .sort((a, b) => b.count - a.count);

  return {
    mostWatched: sorted.slice(0, 5),
    leastWatched: sorted.slice(-5).sort((a, b) => a.count - b.count),
  };
}

export function computeMemberLeaderboard(
  movieData: MovieData[],
  members: Member[],
): MemberLeaderboardEntry[] {
  const entries: MemberLeaderboardEntry[] = members.map((member) => {
    const scores = movieData
      .map((movie) => movie.userScores[member.id])
      .filter(isDefined)
      .filter((score) => !isNaN(score));

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

  if (ranked.length > 1) {
    ranked[0].title = "The Softie";
    ranked[ranked.length - 1].title = "The Hater";
  }

  return ranked;
}

const MIN_SHARED_REVIEWS = 3;
const MAX_RAW_SCORE_DIFF = 10;
const MAX_NORMALIZED_DIFF = 4;

export function computeTasteSimilarity(
  movieData: MovieData[],
  members: Member[],
  useNormalized = false,
): {
  mostSimilar: MemberPairSimilarity | null;
  leastSimilar: MemberPairSimilarity | null;
} {
  if (members.length < 2) {
    return { mostSimilar: null, leastSimilar: null };
  }

  const maxDiff = useNormalized ? MAX_NORMALIZED_DIFF : MAX_RAW_SCORE_DIFF;
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
        const scores = useNormalized ? movie.normalized : movie.userScores;
        const scoreA = scores[memberA.id];
        const scoreB = scores[memberB.id];
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
      const similarityPercent = Math.max(
        0,
        Math.round((1 - avgDifference / maxDiff) * 10000) / 100,
      );

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

const MIN_SCORES_FOR_CONSENSUS = 2;

export function computeClubConsensus(
  movieData: MovieData[],
  members: Member[],
): {
  mostAgreed: ClubConsensusEntry[];
  mostDivisive: ClubConsensusEntry[];
} {
  const memberMap = new Map(members.map((m) => [m.id, m.name]));

  const entries: ClubConsensusEntry[] = [];

  for (const movie of movieData) {
    const scoreEntries: { name: string; score: number }[] = [];
    for (const [memberId, score] of Object.entries(movie.userScores)) {
      if (isDefined(score) && !isNaN(score)) {
        scoreEntries.push({
          name: memberMap.get(memberId) ?? memberId,
          score,
        });
      }
    }

    if (scoreEntries.length < MIN_SCORES_FOR_CONSENSUS) continue;

    const mean =
      scoreEntries.reduce((sum, s) => sum + s.score, 0) / scoreEntries.length;
    const variance =
      scoreEntries.reduce((sum, s) => sum + (s.score - mean) ** 2, 0) /
      scoreEntries.length;
    const stdDev = Math.round(Math.sqrt(variance) * 100) / 100;

    entries.push({
      title: movie.title,
      imageUrl: movie.imageUrl,
      average: movie.average,
      stdDev,
      scores: scoreEntries.sort((a, b) => b.score - a.score),
    });
  }

  const sorted = [...entries].sort((a, b) => a.stdDev - b.stdDev);

  return {
    mostAgreed: sorted.slice(0, 3),
    mostDivisive: sorted.slice(-3).sort((a, b) => b.stdDev - a.stdDev),
  };
}

export interface PersonStats {
  name: string;
  movieCount: number;
  averageScore: number;
  movies: string[];
}

function computeTopPeople(
  movieData: MovieData[],
  getPeople: (movie: MovieData) => readonly string[] | undefined,
): PersonStats[] {
  const peopleMap = new Map<
    string,
    { totalScore: number; count: number; movies: string[] }
  >();

  for (const movie of movieData) {
    const people = getPeople(movie);
    if (!hasElements(people)) continue;
    for (const person of people) {
      const existing = peopleMap.get(person);
      if (existing) {
        existing.totalScore += movie.average;
        existing.count += 1;
        existing.movies.push(movie.title);
      } else {
        peopleMap.set(person, {
          totalScore: movie.average,
          count: 1,
          movies: [movie.title],
        });
      }
    }
  }

  return Array.from(peopleMap.entries())
    .map(([name, data]) => ({
      name,
      movieCount: data.count,
      averageScore: data.totalScore / data.count,
      movies: data.movies,
    }))
    .sort((a, b) => {
      const countDiff = b.movieCount - a.movieCount;
      return countDiff !== 0 ? countDiff : b.averageScore - a.averageScore;
    })
    .slice(0, 5);
}

export function computeTopDirectors(movieData: MovieData[]): PersonStats[] {
  return computeTopPeople(movieData, (m) => m.externalData?.directors);
}

export function computeTopActors(movieData: MovieData[]): PersonStats[] {
  return computeTopPeople(movieData, (m) => m.externalData?.actors);
}

export function computeTmdbDeviation(movieData: MovieData[]): {
  clubRatedHigher: TmdbDeviationEntry[];
  clubRatedLower: TmdbDeviationEntry[];
} {
  const entries: TmdbDeviationEntry[] = [];

  for (const movie of movieData) {
    const tmdbScore = movie.externalData?.vote_average;
    if (!isDefined(tmdbScore) || tmdbScore === 0) continue;

    const deviation = Math.round((movie.average - tmdbScore) * 100) / 100;

    entries.push({
      title: movie.title,
      imageUrl: movie.imageUrl,
      clubScore: Math.round(movie.average * 100) / 100,
      tmdbScore: Math.round(tmdbScore * 100) / 100,
      deviation,
    });
  }

  const sorted = [...entries].sort((a, b) => b.deviation - a.deviation);

  return {
    clubRatedHigher: sorted.slice(0, 5).filter((e) => e.deviation > 0),
    clubRatedLower: sorted
      .slice(-5)
      .filter((e) => e.deviation < 0)
      .sort((a, b) => a.deviation - b.deviation),
  };
}

export function computeScoreTrend(
  movieData: MovieData[],
  members: Member[],
): Map<string, ScoreTrendPoint[]> {
  const result = new Map<string, ScoreTrendPoint[]>();

  for (const member of members) {
    const reviews: { date: Date; title: string; score: number }[] = [];

    for (const movie of movieData) {
      const entry = movie.scores[member.id];
      if (!isDefined(entry) || !hasValue(entry.created_date)) continue;

      const date = new Date(entry.created_date);
      if (isNaN(date.getTime())) continue;

      reviews.push({ date, title: movie.title, score: entry.score });
    }

    if (reviews.length === 0) continue;

    reviews.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Scale window to 20% of the member's reviews so the trend stays readable.
    // A fixed window over-smooths long-running clubs, making all lines converge.
    const windowSize = Math.max(
      5,
      Math.min(30, Math.round(reviews.length * 0.2)),
    );

    const points: ScoreTrendPoint[] = [];
    for (let index = windowSize - 1; index < reviews.length; index++) {
      const review = reviews[index];
      const windowStart = index - windowSize + 1;
      const window = reviews.slice(windowStart, index + 1);
      const avg = window.reduce((sum, r) => sum + r.score, 0) / window.length;

      points.push({
        date: review.date,
        movieTitle: review.title,
        actualScore: review.score,
        rollingAverage: Math.round(avg * 100) / 100,
      });
    }

    result.set(member.id, points);
  }

  return result;
}

const MIN_SCORES_FOR_GUILTY_PLEASURE = 2;
const GUILTY_PLEASURE_THRESHOLD = 2;
const MAX_GUILTY_PLEASURES_PER_MEMBER = 5;

export function computeGuiltyPleasures(
  movieData: MovieData[],
  members: Member[],
): GuiltyPleasureEntry[] {
  const memberMap = new Map(members.map((m) => [m.id, m]));
  const memberMovies = new Map<
    string,
    {
      title: string;
      imageUrl: string | undefined;
      memberScore: number;
      clubAverage: number;
      difference: number;
    }[]
  >();

  for (const movie of movieData) {
    const validScores: { memberId: string; score: number }[] = [];
    for (const [memberId, score] of Object.entries(movie.userScores)) {
      if (isDefined(score) && !isNaN(score) && memberMap.has(memberId)) {
        validScores.push({ memberId, score });
      }
    }

    if (validScores.length < MIN_SCORES_FOR_GUILTY_PLEASURE) continue;

    const outliers = validScores.filter(
      (s) => s.score - movie.average >= GUILTY_PLEASURE_THRESHOLD,
    );

    if (outliers.length !== 1) continue;

    const outlier = outliers[0];
    const difference = Math.round((outlier.score - movie.average) * 100) / 100;

    const existing = memberMovies.get(outlier.memberId);
    const entry = {
      title: movie.title,
      imageUrl: movie.imageUrl,
      memberScore: outlier.score,
      clubAverage: Math.round(movie.average * 100) / 100,
      difference,
    };

    if (isDefined(existing)) {
      existing.push(entry);
    } else {
      memberMovies.set(outlier.memberId, [entry]);
    }
  }

  const entries: GuiltyPleasureEntry[] = [];
  for (const [memberId, movies] of memberMovies) {
    const member = memberMap.get(memberId);
    if (!isDefined(member)) continue;

    movies.sort((a, b) => b.difference - a.difference);
    entries.push({
      member: { id: member.id, name: member.name, image: member.image },
      movies: movies.slice(0, MAX_GUILTY_PLEASURES_PER_MEMBER),
    });
  }

  return entries.sort((a, b) => b.movies.length - a.movies.length);
}

export function computeDecadeStats(
  movieData: MovieData[],
  memberId?: string,
): DecadeStats[] {
  const decadeScores: Record<string, { count: number; totalScore: number }> =
    {};

  for (const movie of movieData) {
    const score = isDefined(memberId)
      ? movie.userScores[memberId]
      : movie.average;
    if (!isDefined(score)) continue;

    const releaseDate = movie.externalData?.release_date;
    if (!hasValue(releaseDate)) continue;

    const year = parseInt(releaseDate.substring(0, 4), 10);
    if (isNaN(year)) continue;

    const decade = `${Math.floor(year / 10) * 10}s`;
    const existing = decadeScores[decade];
    if (isDefined(existing)) {
      existing.count++;
      existing.totalScore += score;
    } else {
      decadeScores[decade] = { count: 1, totalScore: score };
    }
  }

  return Object.entries(decadeScores)
    .map(([decade, data]) => ({
      decade,
      averageScore: Math.round((data.totalScore / data.count) * 100) / 100,
      count: data.count,
    }))
    .sort((a, b) => a.decade.localeCompare(b.decade));
}

function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function computeWatchingPace(
  movieData: MovieData[],
  now: Date = new Date(),
): WatchingPaceStats {
  const moviesByDate = new Map<string, string[]>();

  for (const movie of movieData) {
    if (!hasValue(movie.createdDate)) continue;
    const date = new Date(movie.createdDate);
    if (isNaN(date.getTime())) continue;
    const key = toDateKey(date);
    const existing = moviesByDate.get(key);
    if (isDefined(existing)) {
      existing.push(movie.title);
    } else {
      moviesByDate.set(key, [movie.title]);
    }
  }

  const totalDays = 364;
  const start = new Date(now);
  start.setDate(start.getDate() - totalDays);

  const days: HeatmapDay[] = [];
  let totalMovies = 0;
  let longestStreak = 0;
  let longestDrySpell = 0;
  let currentStreak = 0;
  let currentDrySpell = 0;

  for (let i = 0; i <= totalDays; i++) {
    const current = new Date(start);
    current.setDate(start.getDate() + i);
    const key = toDateKey(current);
    const movies = moviesByDate.get(key) ?? [];
    const count = movies.length;

    days.push({ date: key, count, movies });
    totalMovies += count;

    if (count > 0) {
      currentStreak += 1;
      longestStreak = Math.max(longestStreak, currentStreak);
      currentDrySpell = 0;
    } else {
      currentDrySpell += 1;
      longestDrySpell = Math.max(longestDrySpell, currentDrySpell);
      currentStreak = 0;
    }
  }

  const avgPerMonth = Math.round((totalMovies / 12) * 10) / 10;

  return {
    days,
    totalMovies,
    avgPerMonth,
    longestStreak,
    longestDrySpell,
  };
}
