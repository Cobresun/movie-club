import { DetailedBookData } from "../../../lib/types/book";
import { WorkType } from "../../../lib/types/generated/db";
import { DetailedMovieData } from "../../../lib/types/movie";

/**
 * Score and review metadata shared by every reviewed work, regardless of
 * media type. Score-based widgets and computers should depend on this (via
 * WorkStatsData) so they work for any club type.
 */
export interface WorkStatsBase {
  id: string;
  title: string;
  createdDate: string;
  imageUrl: string | undefined;
  average: number;
  userScores: Record<string, number | undefined>;
  scores: Record<string, { id: string; created_date: string; score: number }>;
  dateWatched: string;
}

export interface MovieData extends WorkStatsBase {
  type: WorkType.movie;
  genres: string[];
  production_companies: string[];
  production_countries: string[];
  externalData: DetailedMovieData;
}

export interface BookData extends WorkStatsBase {
  type: WorkType.book;
  // Optional: book stats are score-only in Phase 1, so a book review without
  // OpenLibrary metadata still counts toward statistics.
  externalData?: DetailedBookData;
}

export type WorkStatsData = MovieData | BookData;

export function isMovieStats(work: WorkStatsData): work is MovieData {
  return work.type === WorkType.movie;
}

export function isBookStats(work: WorkStatsData): work is BookData {
  return work.type === WorkType.book;
}

export type HistogramData = {
  bin: number;
  [index: string]: number;
};

export interface GenreStats {
  genre: string;
  averageScore: number;
  count: number;
}

export interface GenreWatchCount {
  genre: string;
  count: number;
}

export interface DecadeStats {
  decade: string;
  averageScore: number;
  count: number;
}

export interface SubjectScoreStats {
  subject: string;
  averageScore: number;
  count: number;
}

export interface SubjectReadCount {
  subject: string;
  count: number;
}

export interface MemberLeaderboardEntry {
  member: { id: string; name: string; image?: string; role?: string };
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

export interface TmdbDeviationEntry {
  title: string;
  imageUrl: string | undefined;
  clubScore: number;
  tmdbScore: number;
  deviation: number;
}

export interface ClubConsensusEntry {
  title: string;
  imageUrl: string | undefined;
  average: number;
  stdDev: number;
  scores: { name: string; score: number }[];
}

export interface HighestRatedByYearEntry {
  year: number;
  title: string;
  imageUrl: string | undefined;
  average: number;
  movieCount: number;
}

export interface ScoreTrendPoint {
  date: Date;
  movieTitle: string;
  actualScore: number;
  rollingAverage: number;
}

export interface ScoreVariancePoint {
  date: Date;
  movieTitle: string;
  movieStdDev: number;
  rollingStdDev: number;
}

export interface GuiltyPleasureMovie {
  title: string;
  imageUrl: string | undefined;
  memberScore: number;
  clubAverage: number;
  difference: number;
}

export interface GuiltyPleasureEntry {
  member: { id: string; name: string; image?: string };
  movies: GuiltyPleasureMovie[];
}

export interface ClubCurmudgeonMovie {
  title: string;
  imageUrl: string | undefined;
  memberScore: number;
  clubAverage: number;
  difference: number;
}

export interface ClubCurmudgeonEntry {
  member: { id: string; name: string; image?: string };
  movies: ClubCurmudgeonMovie[];
}

export interface MemberPairSimilarity {
  memberA: { id: string; name: string; image?: string };
  memberB: { id: string; name: string; image?: string };
  similarityPercent: number;
  avgDifference: number;
  sharedCount: number;
  bestAgreements: MovieAgreement[];
  worstAgreements: MovieAgreement[];
}
