import { WorkType } from "../../../lib/types/generated/db";
import { DetailedMovieData } from "../../../lib/types/movie";

export interface MovieData {
  id: string;
  type: WorkType.movie;
  title: string;
  createdDate: string;
  imageUrl: string | undefined;
  genres: string[];
  production_companies: string[];
  production_countries: string[];
  average: number;
  userScores: Record<string, number>;
  normalized: Record<string, number>;
  scores: Record<string, { id: string; created_date: string; score: number }>;
  externalData: DetailedMovieData;
  dateWatched: string;
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

export interface MemberPairSimilarity {
  memberA: { id: string; name: string; image?: string };
  memberB: { id: string; name: string; image?: string };
  similarityPercent: number;
  avgDifference: number;
  sharedCount: number;
  bestAgreements: MovieAgreement[];
  worstAgreements: MovieAgreement[];
}
