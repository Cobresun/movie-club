import type {
  BookData,
  ClubConsensusEntry,
  ClubCurmudgeonEntry,
  DecadeStats,
  GenreStats,
  GenreWatchCount,
  GuiltyPleasureEntry,
  HighestRatedByYearEntry,
  MemberLeaderboardEntry,
  MemberPairSimilarity,
  MovieData,
  ScoreTrendPoint,
  ScoreVariancePoint,
  SubjectReadCount,
  SubjectScoreStats,
  TmdbDeviationEntry,
  WorkStatsData,
} from "./types";
import {
  hasValue,
  isDefined,
  hasElements,
} from "../../../lib/checks/checks.js";
import { Member } from "../../../lib/types/club.js";

const MIN_GENRE_COUNT = 2;

/**
 * Tallies score sum + count per category label (genre, subject, …) across works,
 * using each work's member score when `memberId` is set or the club average
 * otherwise. Shared by the movie genre and book subject computers so both apply
 * the same "skip works without a score" rule.
 */
function accumulateCategoryScores<T extends WorkStatsData>(
  works: T[],
  getCategories: (work: T) => readonly string[],
  memberId?: string,
): Record<string, { count: number; totalScore: number }> {
  const categoryScores: Record<string, { count: number; totalScore: number }> =
    {};

  for (const work of works) {
    const score = isDefined(memberId)
      ? work.userScores[memberId]
      : work.average;
    if (!isDefined(score)) continue;
    for (const category of getCategories(work)) {
      const existing = categoryScores[category];
      if (isDefined(existing)) {
        existing.count++;
        existing.totalScore += score;
      } else {
        categoryScores[category] = { count: 1, totalScore: score };
      }
    }
  }

  return categoryScores;
}

export function computeGenreStats(
  movieData: MovieData[],
  memberId?: string,
): {
  mostLoved: GenreStats[];
  leastLoved: GenreStats[];
} {
  const genreScores = accumulateCategoryScores(
    movieData,
    (movie) => movie.genres,
    memberId,
  );

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

// Subjects are noisier and higher-cardinality than movie genres (a book can
// carry a dozen), so require a couple of reads before a subject counts and cap
// the widget to the top handful.
const MIN_SUBJECT_COUNT = 2;
const MAX_SUBJECTS = 5;

/** Average club/member score per book subject, top {@link MAX_SUBJECTS} by score. */
export function computeSubjectStats(
  bookData: BookData[],
  memberId?: string,
): SubjectScoreStats[] {
  const subjectScores = accumulateCategoryScores(
    bookData,
    (book) => book.externalData?.subjects ?? [],
    memberId,
  );

  return Object.entries(subjectScores)
    .filter(([, data]) => data.count >= MIN_SUBJECT_COUNT)
    .map(([subject, data]) => ({
      subject,
      averageScore: Math.round((data.totalScore / data.count) * 100) / 100,
      count: data.count,
    }))
    .sort((a, b) => {
      const scoreDiff = b.averageScore - a.averageScore;
      return scoreDiff !== 0 ? scoreDiff : b.count - a.count;
    })
    .slice(0, MAX_SUBJECTS);
}

/** Read counts per book subject, top {@link MAX_SUBJECTS} by count. */
export function computeSubjectReadCounts(
  bookData: BookData[],
): SubjectReadCount[] {
  const counts: Record<string, number> = {};

  for (const book of bookData) {
    for (const subject of book.externalData?.subjects ?? []) {
      counts[subject] = (counts[subject] ?? 0) + 1;
    }
  }

  return Object.entries(counts)
    .map(([subject, count]) => ({ subject, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_SUBJECTS);
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
  workData: WorkStatsData[],
  members: Member[],
): MemberLeaderboardEntry[] {
  const entries: MemberLeaderboardEntry[] = members.map((member) => {
    const scores = workData
      .map((work) => work.userScores[member.id])
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

export function computeTasteSimilarity(
  workData: WorkStatsData[],
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

      for (const movie of workData) {
        const scores = movie.userScores;
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
        Math.round((1 - avgDifference / MAX_RAW_SCORE_DIFF) * 10000) / 100,
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
  workData: WorkStatsData[],
  members: Member[],
): {
  mostAgreed: ClubConsensusEntry[];
  mostDivisive: ClubConsensusEntry[];
} {
  const memberMap = new Map(members.map((m) => [m.id, m.name]));

  const entries: ClubConsensusEntry[] = [];

  for (const movie of workData) {
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

const TMDB_PROFILE_BASE_URL = "https://image.tmdb.org/t/p/w185";

export interface PersonStats {
  name: string;
  workCount: number;
  averageScore: number;
  works: string[];
  profileImageUrl?: string;
}

/** A person credited on a work, with an already-resolved avatar URL (movies
 * carry a TMDB profile image; book authors have none). */
interface CreditedPerson {
  name: string;
  profileImageUrl: string | undefined;
}

function computeTopPeople<T extends WorkStatsData>(
  workData: T[],
  getPeople: (work: T) => readonly CreditedPerson[] | undefined,
): PersonStats[] {
  const peopleMap = new Map<
    string,
    {
      totalScore: number;
      count: number;
      works: string[];
      profileImageUrl: string | undefined;
    }
  >();

  for (const work of workData) {
    const people = getPeople(work);
    if (!hasElements(people)) continue;
    for (const person of people) {
      const existing = peopleMap.get(person.name);
      if (existing) {
        existing.totalScore += work.average;
        existing.count += 1;
        existing.works.push(work.title);
        if (
          !isDefined(existing.profileImageUrl) &&
          isDefined(person.profileImageUrl)
        ) {
          existing.profileImageUrl = person.profileImageUrl;
        }
      } else {
        peopleMap.set(person.name, {
          totalScore: work.average,
          count: 1,
          works: [work.title],
          profileImageUrl: person.profileImageUrl,
        });
      }
    }
  }

  return Array.from(peopleMap.entries())
    .map(([name, data]) => ({
      name,
      workCount: data.count,
      averageScore: data.totalScore / data.count,
      works: data.works,
      profileImageUrl: data.profileImageUrl,
    }))
    .sort((a, b) => {
      const countDiff = b.workCount - a.workCount;
      return countDiff !== 0 ? countDiff : b.averageScore - a.averageScore;
    })
    .slice(0, 5);
}

function tmdbProfileImageUrl(profilePath: string | null): string | undefined {
  return isDefined(profilePath)
    ? `${TMDB_PROFILE_BASE_URL}${profilePath}`
    : undefined;
}

export function computeTopDirectors(movieData: MovieData[]): PersonStats[] {
  return computeTopPeople(movieData, (m) =>
    m.externalData.directors.map((d) => ({
      name: d.name,
      profileImageUrl: tmdbProfileImageUrl(d.profilePath),
    })),
  );
}

export function computeTopActors(movieData: MovieData[]): PersonStats[] {
  return computeTopPeople(movieData, (m) =>
    m.externalData.actors.map((a) => ({
      name: a.name,
      profileImageUrl: tmdbProfileImageUrl(a.profilePath),
    })),
  );
}

/** Most-read authors leaderboard. Authors are plain strings from Google Books,
 * so there is no avatar to show. */
export function computeTopAuthors(bookData: BookData[]): PersonStats[] {
  return computeTopPeople(bookData, (book) =>
    book.externalData?.authors.map((name) => ({
      name,
      profileImageUrl: undefined,
    })),
  );
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
  workData: WorkStatsData[],
  members: Member[],
): Map<string, ScoreTrendPoint[]> {
  const result = new Map<string, ScoreTrendPoint[]>();

  for (const member of members) {
    const reviews: { date: Date; title: string; score: number }[] = [];

    for (const movie of workData) {
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

const MIN_SCORES_FOR_VARIANCE = 2;

export function computeScoreVariance(
  workData: WorkStatsData[],
): ScoreVariancePoint[] {
  const perMovie: { date: Date; title: string; stdDev: number }[] = [];

  for (const movie of workData) {
    const scores: number[] = [];
    for (const score of Object.values(movie.userScores)) {
      if (isDefined(score) && !isNaN(score)) scores.push(score);
    }

    if (scores.length < MIN_SCORES_FOR_VARIANCE) continue;
    if (!hasValue(movie.createdDate)) continue;

    const date = new Date(movie.createdDate);
    if (isNaN(date.getTime())) continue;

    const mean = scores.reduce((sum, s) => sum + s, 0) / scores.length;
    const variance =
      scores.reduce((sum, s) => sum + (s - mean) ** 2, 0) / scores.length;
    const stdDev = Math.sqrt(variance);

    perMovie.push({ date, title: movie.title, stdDev });
  }

  if (perMovie.length === 0) return [];

  perMovie.sort((a, b) => a.date.getTime() - b.date.getTime());

  // Mirror computeScoreTrend's adaptive window: 20% of the data, clamped to
  // 5..30, so the line stays readable for both new and long-running clubs.
  const windowSize = Math.max(
    5,
    Math.min(30, Math.round(perMovie.length * 0.2)),
  );

  const points: ScoreVariancePoint[] = [];
  for (let index = windowSize - 1; index < perMovie.length; index++) {
    const entry = perMovie[index];
    const window = perMovie.slice(index - windowSize + 1, index + 1);
    const avg = window.reduce((sum, m) => sum + m.stdDev, 0) / window.length;

    points.push({
      date: entry.date,
      movieTitle: entry.title,
      movieStdDev: Math.round(entry.stdDev * 100) / 100,
      rollingStdDev: Math.round(avg * 100) / 100,
    });
  }

  return points;
}

const MIN_SCORES_FOR_GUILTY_PLEASURE = 2;
const GUILTY_PLEASURE_THRESHOLD = 2;
const MAX_GUILTY_PLEASURES_PER_MEMBER = 5;

export function computeGuiltyPleasures(
  workData: WorkStatsData[],
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

  for (const movie of workData) {
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

const MIN_SCORES_FOR_CURMUDGEON = 2;
const CURMUDGEON_THRESHOLD = 2;
const MAX_CURMUDGEON_MOVIES_PER_MEMBER = 5;

export function computeClubCurmudgeons(
  workData: WorkStatsData[],
  members: Member[],
): ClubCurmudgeonEntry[] {
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

  for (const movie of workData) {
    const validScores: { memberId: string; score: number }[] = [];
    for (const [memberId, score] of Object.entries(movie.userScores)) {
      if (isDefined(score) && !isNaN(score) && memberMap.has(memberId)) {
        validScores.push({ memberId, score });
      }
    }

    if (validScores.length < MIN_SCORES_FOR_CURMUDGEON) continue;

    const outliers = validScores.filter(
      (s) => movie.average - s.score >= CURMUDGEON_THRESHOLD,
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

  const entries: ClubCurmudgeonEntry[] = [];
  for (const [memberId, movies] of memberMovies) {
    const member = memberMap.get(memberId);
    if (!isDefined(member)) continue;

    movies.sort((a, b) => a.difference - b.difference);
    entries.push({
      member: { id: member.id, name: member.name, image: member.image },
      movies: movies.slice(0, MAX_CURMUDGEON_MOVIES_PER_MEMBER),
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

/** Average score grouped by a book's publication decade (from
 * `firstPublishYear`). Mirrors {@link computeDecadeStats}, which reads a movie's
 * `release_date` string instead. */
export function computePublishDecadeStats(
  bookData: BookData[],
  memberId?: string,
): DecadeStats[] {
  const decadeScores: Record<string, { count: number; totalScore: number }> =
    {};

  for (const book of bookData) {
    const score = isDefined(memberId)
      ? book.userScores[memberId]
      : book.average;
    if (!isDefined(score)) continue;

    const year = book.externalData?.firstPublishYear;
    if (!isDefined(year) || isNaN(year)) continue;

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

export function computeHighestRatedByYear(
  movieData: MovieData[],
): HighestRatedByYearEntry[] {
  const yearGroups = new Map<
    number,
    { best: MovieData | null; count: number }
  >();

  for (const movie of movieData) {
    if (!hasValue(movie.createdDate)) continue;

    const watchedDate = new Date(movie.createdDate);
    if (isNaN(watchedDate.getTime())) continue;

    // createdDate is a UTC ISO timestamp; read the year in UTC so grouping is
    // timezone-independent (getFullYear() rolls a `...T00:00:00Z` date back a
    // year west of UTC). Matches the string-based year parsing in the decade stats.
    const year = watchedDate.getUTCFullYear();
    const group = yearGroups.get(year);
    if (isDefined(group)) {
      group.count++;
      if (!isDefined(group.best) || movie.average > group.best.average) {
        group.best = movie;
      }
    } else {
      yearGroups.set(year, { best: movie, count: 1 });
    }
  }

  const entries: HighestRatedByYearEntry[] = [];
  for (const [year, group] of yearGroups) {
    if (!isDefined(group.best)) continue;
    entries.push({
      year,
      title: group.best.title,
      imageUrl: group.best.imageUrl,
      average: Math.round(group.best.average * 100) / 100,
      movieCount: group.count,
    });
  }

  return entries.sort((a, b) => b.year - a.year);
}
