import { DetailedBookData } from "../../../lib/types/book";
import { WorkType } from "../../../lib/types/generated/db";
import { MovieDataSummary } from "../../../lib/types/movie";

/**
 * Score and review metadata shared by every reviewed work, regardless of
 * media type. Score-based widgets and computers should depend on this (via
 * WorkStatsData) so they work for any club type.
 */
export interface WorkStatsBase {
  id: string;
  title: string;
  createdDate: string;
  /** Provider id of the work — the join key for the bulk cast endpoint. */
  externalId: string | undefined;
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
  externalData: MovieDataSummary;
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
  workCount: number;
}

export interface MonthlyActivityPoint {
  /** First day of the month (UTC) — plotted on a time axis. */
  month: Date;
  /** Preformatted "Mar 2024" for tooltips. */
  label: string;
  count: number;
}

export interface CumulativeCountPoint {
  date: Date;
  /** Title of the work reviewed at this point, for tooltips. */
  title: string;
  /** Works reviewed up to and including this one. */
  total: number;
}

export interface ClubRecordEntry {
  title: string;
  imageUrl: string | undefined;
  /** The record's headline number (average score, or score spread). */
  value: number;
}

export interface ClubRecords {
  highest: ClubRecordEntry | null;
  lowest: ClubRecordEntry | null;
  /** Work with the widest member score spread (std dev as `value`). */
  mostDivisive: ClubRecordEntry | null;
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
