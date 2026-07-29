import { DateTime } from "luxon";

import { hasElements, hasValue, isDefined } from "../../../lib/checks/checks.js";
import { WorkType } from "../../../lib/types/generated/db";
import { DetailedReviewListItem } from "../../../lib/types/lists";
import { CLUB_TYPE_CONFIG } from "@/common/clubType";
import { asBook, asMovie, formatRuntime } from "@/common/workDisplay";

/**
 * One spotlight fact about a fully-scored review ("highest-rated movie in club
 * history", "your club's 50th movie", …). Computed client-side from the public
 * reviews list, so the review drawer and the shared review page can show the
 * exact same fact without a dedicated endpoint.
 */
export interface ReviewFact {
  kind: FactKind;
  /** mdi icon name — every value must be registered in `src/icons.ts`. */
  icon: string;
  /** Short eyebrow label ("Club record", "Milestone"). */
  label: string;
  /** The full fact sentence. */
  text: string;
}

/**
 * Icon per fact kind, exported as a registry so `icons.test.ts` can assert
 * every name is registered (they reach templates via a computed, which the
 * static icon scan can't see).
 */
export const FACT_ICONS = {
  allTimeHigh: "trophy",
  allTimeLow: "trophy-broken",
  clubMilestone: "cake-variant",
  watchTimeMilestone: "sofa",
  pagesMilestone: "bookshelf",
  divisive: "sword-cross",
  yearHigh: "medal",
  yearLow: "thumb-down",
  personHigh: "star-circle",
  personLow: "star-off",
  actorMilestone: "account-star",
  timeTravel: "history",
  longestRuntime: "seat-recline-extra",
  longestBook: "book-open-page-variant",
  countryFirst: "passport",
  decadeFirst: "calendar-star",
  firstGenre: "star-shooting",
  tmdbDeviation: "scale-unbalanced",
} as const;

export type FactKind = keyof typeof FACT_ICONS;

interface FactContext {
  target: DetailedReviewListItem;
  /** Every reviews-list work, oldest first. */
  works: DetailedReviewListItem[];
  /** Works up to and including the target, so count facts stay true forever. */
  worksThrough: DetailedReviewListItem[];
  /** Works with a club average, oldest first (includes the target). */
  scored: DetailedReviewListItem[];
  /** 1-based position of the target within {@link works}. */
  position: number;
  targetAverage: number;
  targetDate: DateTime;
  /** "movie" or "book", from the shared club-type registry. */
  noun: string;
}

type FactGenerator = (ctx: FactContext) => ReviewFact | undefined;

const fact = (kind: FactKind, label: string, text: string): ReviewFact => ({
  kind,
  icon: FACT_ICONS[kind],
  label,
  text,
});

const averageOf = (work: DetailedReviewListItem): number | undefined => work.scores.average?.score;

/** Individual member scores on a work (the synthetic average excluded). */
const memberScoresOf = (work: DetailedReviewListItem): number[] =>
  Object.entries(work.scores)
    .filter(([id]) => id !== "average")
    .map(([, review]) => review.score)
    .filter((score) => !isNaN(score));

/** Review timestamps are UTC; read calendar fields in UTC so facts don't
 * shift across timezones (same convention as the statistics computers). */
const utcDate = (iso: string): DateTime => DateTime.fromISO(iso, { zone: "utc" });

const formatScore = (score: number): string => String(Math.round(score * 10) / 10);

function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

// ---------------------------------------------------------------------------
// Generators, one per fact kind. Each returns undefined when the target doesn't
// qualify; thresholds keep facts rare enough to stay special.
// ---------------------------------------------------------------------------

// Records against all-time history are meaningless in a brand-new club, where
// every review would be "the best yet".
const MIN_WORKS_FOR_ALL_TIME_RECORD = 10;

const allTimeRecord: FactGenerator = (ctx) => {
  if (ctx.scored.length < MIN_WORKS_FOR_ALL_TIME_RECORD) return undefined;
  const others = ctx.scored
    .filter((work) => work.id !== ctx.target.id)
    .map(averageOf)
    .filter(isDefined);
  if (!hasElements(others)) return undefined;
  if (ctx.targetAverage > Math.max(...others)) {
    return fact(
      "allTimeHigh",
      "Club record",
      `At ${formatScore(ctx.targetAverage)}, this is the highest-rated ${ctx.noun} in club history.`,
    );
  }
  if (ctx.targetAverage < Math.min(...others)) {
    return fact(
      "allTimeLow",
      "Club record",
      `At ${formatScore(ctx.targetAverage)}, this is the lowest-rated ${ctx.noun} in club history.`,
    );
  }
  return undefined;
};

const isCountMilestone = (n: number): boolean => n === 10 || n === 25 || (n >= 50 && n % 50 === 0);

const clubMilestone: FactGenerator = (ctx) => {
  if (!isCountMilestone(ctx.position)) return undefined;
  return fact(
    "clubMilestone",
    "Milestone",
    `This is the ${ordinal(ctx.position)} ${ctx.noun} your club has reviewed!`,
  );
};

/** TMDB uses runtime 0 (and Google Books page count 0) for "unknown". */
const positiveOrUndefined = (n: number | undefined): number | undefined =>
  isDefined(n) && n > 0 ? n : undefined;

const runtimeOf = (work: DetailedReviewListItem): number | undefined =>
  positiveOrUndefined(asMovie(work.externalData)?.runtime);

const pagesOf = (work: DetailedReviewListItem): number | undefined =>
  positiveOrUndefined(asBook(work.externalData)?.numberOfPages);

/**
 * The largest milestone the club crossed with this review: the running total
 * was below it before the target and at/above it after. Anchored to
 * worksThrough (like clubMilestone) so the fact stays true forever.
 */
function crossedMilestone(
  ctx: FactContext,
  amountOf: (work: DetailedReviewListItem) => number | undefined,
  milestones: readonly number[],
): number | undefined {
  const targetAmount = amountOf(ctx.target);
  if (!isDefined(targetAmount)) return undefined;
  const before = ctx.worksThrough
    .filter((work) => work.id !== ctx.target.id)
    .map(amountOf)
    .filter(isDefined)
    .reduce((sum, amount) => sum + amount, 0);
  const through = before + targetAmount;
  return [...milestones].reverse().find((m) => before < m && through >= m);
}

const WATCH_HOUR_MILESTONES = [24, 48, 100, 250, 500, 1000, 2000];

const watchTimeMilestone: FactGenerator = (ctx) => {
  const hours = crossedMilestone(
    ctx,
    (work) => {
      const minutes = runtimeOf(work);
      return isDefined(minutes) ? minutes / 60 : undefined;
    },
    WATCH_HOUR_MILESTONES,
  );
  if (!isDefined(hours)) return undefined;
  const days = Math.floor(hours / 24);
  const stretch = days === 1 ? "a full day on the couch" : `over ${days} full days on the couch`;
  return fact(
    "watchTimeMilestone",
    "Couch time",
    `This one tipped your club past ${hours} hours of movies watched together — ${stretch}.`,
  );
};

const PAGE_MILESTONES = [5000, 10000, 25000, 50000, 100000, 250000];
const PAGES_OF_WAR_AND_PEACE = 1225;

const pagesMilestone: FactGenerator = (ctx) => {
  const pages = crossedMilestone(ctx, pagesOf, PAGE_MILESTONES);
  if (!isDefined(pages)) return undefined;
  const copies = Math.round(pages / PAGES_OF_WAR_AND_PEACE);
  return fact(
    "pagesMilestone",
    "Bookworms",
    `This one pushed your club past ${pages.toLocaleString("en-US")} pages read together — about ${copies} copies of War and Peace.`,
  );
};

const MIN_WORKS_FOR_DIVISIVE_RECORD = 10;
const DIVISIVE_MIN_SPREAD = 4;

const spreadOf = (work: DetailedReviewListItem): number | undefined => {
  const scores = memberScoresOf(work);
  return scores.length >= 2 ? Math.max(...scores) - Math.min(...scores) : undefined;
};

const divisiveRecord: FactGenerator = (ctx) => {
  if (ctx.scored.length < MIN_WORKS_FOR_DIVISIVE_RECORD) return undefined;
  const scores = memberScoresOf(ctx.target);
  const targetSpread = spreadOf(ctx.target);
  if (!isDefined(targetSpread) || targetSpread < DIVISIVE_MIN_SPREAD) {
    return undefined;
  }
  const otherSpreads = ctx.scored
    .filter((work) => work.id !== ctx.target.id)
    .map(spreadOf)
    .filter(isDefined);
  if (!hasElements(otherSpreads)) return undefined;
  if (targetSpread <= Math.max(...otherSpreads)) return undefined;
  return fact(
    "divisive",
    "Divisive",
    `Scores ran from ${formatScore(Math.min(...scores))} to ${formatScore(Math.max(...scores))} — the most divisive pick in club history.`,
  );
};

// "Best of the year" needs a real cohort behind it, not a January debut.
const MIN_WORKS_FOR_YEAR_RECORD = 5;

const yearRecord: FactGenerator = (ctx) => {
  const year = ctx.targetDate.year;
  const cohort = ctx.scored.filter((work) => utcDate(work.createdDate).year === year);
  if (cohort.length < MIN_WORKS_FOR_YEAR_RECORD) return undefined;
  const others = cohort
    .filter((work) => work.id !== ctx.target.id)
    .map(averageOf)
    .filter(isDefined);
  if (!hasElements(others)) return undefined;
  if (ctx.targetAverage > Math.max(...others)) {
    return fact(
      "yearHigh",
      `Best of ${year}`,
      `The highest-rated of the ${cohort.length} ${ctx.noun}s your club has reviewed in ${year}.`,
    );
  }
  if (ctx.targetAverage < Math.min(...others)) {
    return fact(
      "yearLow",
      `Rough one`,
      `The lowest-rated of the ${cohort.length} ${ctx.noun}s your club has reviewed in ${year}.`,
    );
  }
  return undefined;
};

// A "best/worst by this person" verdict needs a filmography, not a rematch.
const MIN_WORKS_FOR_PERSON_RECORD = 3;

/**
 * Shared engine for the director/author record facts: is the target the
 * highest- or lowest-rated of at least {@link MIN_WORKS_FOR_PERSON_RECORD}
 * works credited to the same person?
 */
function personRecord(
  ctx: FactContext,
  targetPeople: readonly string[],
  peopleOf: (work: DetailedReviewListItem) => readonly string[],
  describe: (count: number, name: string) => { high: string; low: string },
): ReviewFact | undefined {
  for (const name of targetPeople) {
    const others = ctx.scored
      .filter((work) => work.id !== ctx.target.id && peopleOf(work).includes(name))
      .map(averageOf)
      .filter(isDefined);
    if (others.length + 1 < MIN_WORKS_FOR_PERSON_RECORD) continue;
    const phrasing = describe(others.length + 1, name);
    if (ctx.targetAverage > Math.max(...others)) {
      return fact("personHigh", "A new favorite", phrasing.high);
    }
    if (ctx.targetAverage < Math.min(...others)) {
      return fact("personLow", "A low point", phrasing.low);
    }
  }
  return undefined;
}

const directorRecord: FactGenerator = (ctx) => {
  const movie = asMovie(ctx.target.externalData);
  if (!isDefined(movie)) return undefined;
  return personRecord(
    ctx,
    movie.directors.map((d) => d.name),
    (work) => asMovie(work.externalData)?.directors.map((d) => d.name) ?? [],
    (count, name) => ({
      high: `Your club's highest-rated of ${count} films directed by ${name}.`,
      low: `Your club's lowest-rated of ${count} films directed by ${name}.`,
    }),
  );
};

const authorRecord: FactGenerator = (ctx) => {
  const book = asBook(ctx.target.externalData);
  if (!isDefined(book)) return undefined;
  return personRecord(
    ctx,
    book.authors,
    (work) => asBook(work.externalData)?.authors ?? [],
    (count, name) => ({
      high: `Your club's highest-rated of ${count} books by ${name}.`,
      low: `Your club's lowest-rated of ${count} books by ${name}.`,
    }),
  );
};

const isActorMilestone = (n: number): boolean => n >= 5 && n % 5 === 0;

// A "familiar face" milestone should celebrate a recognizable recurring actor,
// not a bit-part player buried deep in the credits. `majorCastNames` is the
// server-filtered major cast (top-billed OR a popularity star — see
// lib/movie/majorCast.ts), so we count an actor only across the movies where
// they were a prominent presence, never an incidental cameo.
const actorMilestone: FactGenerator = (ctx) => {
  const movie = asMovie(ctx.target.externalData);
  if (!isDefined(movie)) return undefined;
  let best: { name: string; count: number } | undefined;
  for (const name of movie.majorCastNames) {
    const count = ctx.worksThrough.filter(
      (work) => asMovie(work.externalData)?.majorCastNames.includes(name) === true,
    ).length;
    if (isActorMilestone(count) && (!isDefined(best) || count > best.count)) {
      best = { name, count };
    }
  }
  if (!isDefined(best)) return undefined;
  return fact(
    "actorMilestone",
    "Familiar face",
    `That's the ${ordinal(best.count)} movie your club has watched featuring ${best.name}.`,
  );
};

const releaseYearOf = (work: DetailedReviewListItem): number | undefined => {
  const date = asMovie(work.externalData)?.release_date;
  if (!hasValue(date)) return undefined;
  const year = Number(date.slice(0, 4));
  return isNaN(year) ? undefined : year;
};

/**
 * Metadata values ("runtime", "release year") of every other work in club
 * history, for record comparisons — same all-history framing as the score
 * records, but keyed on data that doesn't need scores.
 */
function otherValues(
  ctx: FactContext,
  valueOf: (work: DetailedReviewListItem) => number | undefined,
): number[] {
  return ctx.works
    .filter((work) => work.id !== ctx.target.id)
    .map(valueOf)
    .filter(isDefined);
}

const oldestMovie: FactGenerator = (ctx) => {
  if (ctx.works.length < MIN_WORKS_FOR_ALL_TIME_RECORD) return undefined;
  const year = releaseYearOf(ctx.target);
  if (!isDefined(year)) return undefined;
  const others = otherValues(ctx, releaseYearOf);
  if (!hasElements(others) || year >= Math.min(...others)) return undefined;
  return fact(
    "timeTravel",
    "Time travel",
    `Released in ${year}, this is the oldest movie your club has ever watched.`,
  );
};

const oldestBook: FactGenerator = (ctx) => {
  if (ctx.works.length < MIN_WORKS_FOR_ALL_TIME_RECORD) return undefined;
  const year = asBook(ctx.target.externalData)?.firstPublishYear;
  if (!isDefined(year)) return undefined;
  const others = otherValues(ctx, (work) => asBook(work.externalData)?.firstPublishYear);
  if (!hasElements(others) || year >= Math.min(...others)) return undefined;
  return fact(
    "timeTravel",
    "Time travel",
    `First published in ${year}, this is the oldest book your club has ever read.`,
  );
};

const longestRuntime: FactGenerator = (ctx) => {
  if (ctx.works.length < MIN_WORKS_FOR_ALL_TIME_RECORD) return undefined;
  const runtime = runtimeOf(ctx.target);
  if (!isDefined(runtime)) return undefined;
  const others = otherValues(ctx, runtimeOf);
  if (!hasElements(others) || runtime <= Math.max(...others)) return undefined;
  return fact(
    "longestRuntime",
    "Settle in",
    `At ${formatRuntime(runtime)}, this is the longest movie your club has ever sat through.`,
  );
};

const longestBook: FactGenerator = (ctx) => {
  if (ctx.works.length < MIN_WORKS_FOR_ALL_TIME_RECORD) return undefined;
  const pages = pagesOf(ctx.target);
  if (!isDefined(pages)) return undefined;
  const others = otherValues(ctx, pagesOf);
  if (!hasElements(others) || pages <= Math.max(...others)) return undefined;
  return fact(
    "longestBook",
    "Doorstopper",
    `At ${pages.toLocaleString("en-US")} pages, this is the longest book your club has ever conquered.`,
  );
};

// In a young club almost every movie is a "first <something>" — wait until the
// club has enough history for a new genre/country/decade to be a genuine event.
const MIN_PRIOR_WORKS_FOR_FIRSTS = 10;

const countryFirst: FactGenerator = (ctx) => {
  const movie = asMovie(ctx.target.externalData);
  if (!isDefined(movie) || !hasElements(movie.production_countries)) {
    return undefined;
  }
  const prior = ctx.worksThrough.filter((work) => work.id !== ctx.target.id);
  if (prior.length < MIN_PRIOR_WORKS_FOR_FIRSTS) return undefined;
  const seen = new Set(
    prior.flatMap((work) => asMovie(work.externalData)?.production_countries ?? []),
  );
  // An empty seen-set means the history lacks country data, not that every
  // country is new.
  if (seen.size === 0) return undefined;
  const newCountry = movie.production_countries.find((country) => !seen.has(country));
  if (!hasValue(newCountry)) return undefined;
  return fact("countryFirst", "Passport stamp", `Your club's first movie from ${newCountry}.`);
};

const decadeFirst: FactGenerator = (ctx) => {
  const year = releaseYearOf(ctx.target);
  if (!isDefined(year)) return undefined;
  const prior = ctx.worksThrough.filter((work) => work.id !== ctx.target.id);
  if (prior.length < MIN_PRIOR_WORKS_FOR_FIRSTS) return undefined;
  const decadeOf = (y: number): number => Math.floor(y / 10) * 10;
  const seen = new Set(prior.map(releaseYearOf).filter(isDefined).map(decadeOf));
  if (seen.size === 0 || seen.has(decadeOf(year))) return undefined;
  return fact("decadeFirst", "Time capsule", `Your club's first trip to the ${decadeOf(year)}s.`);
};

const firstGenre: FactGenerator = (ctx) => {
  const movie = asMovie(ctx.target.externalData);
  if (!isDefined(movie) || !hasElements(movie.genres)) return undefined;
  const prior = ctx.worksThrough.filter((work) => work.id !== ctx.target.id);
  if (prior.length < MIN_PRIOR_WORKS_FOR_FIRSTS) return undefined;
  const seen = new Set(prior.flatMap((work) => asMovie(work.externalData)?.genres ?? []));
  const newGenre = movie.genres.find((genre) => !seen.has(genre));
  if (!hasValue(newGenre)) return undefined;
  return fact("firstGenre", "New territory", `Your club's first ${newGenre} movie.`);
};

const TMDB_DEVIATION_THRESHOLD = 2.5;

const tmdbDeviation: FactGenerator = (ctx) => {
  const tmdbScore = asMovie(ctx.target.externalData)?.vote_average;
  if (!isDefined(tmdbScore) || tmdbScore === 0) return undefined;
  const deviation = ctx.targetAverage - tmdbScore;
  if (Math.abs(deviation) < TMDB_DEVIATION_THRESHOLD) return undefined;
  const direction = deviation > 0 ? "higher" : "lower";
  return fact(
    "tmdbDeviation",
    "Hot take",
    `Your club scored this ${formatScore(Math.abs(deviation))} points ${direction} than its ${formatScore(tmdbScore)} TMDB rating.`,
  );
};

/**
 * Ordered candidate generators per work type, most interesting first — the
 * first one that fires wins. Keyed by WorkType (same feature-local registry
 * pattern as WORK_STATS_BUILDERS) so a new club type must declare its list.
 */
const FACT_GENERATORS: Record<WorkType, FactGenerator[]> = {
  [WorkType.movie]: [
    allTimeRecord,
    clubMilestone,
    watchTimeMilestone,
    divisiveRecord,
    yearRecord,
    directorRecord,
    actorMilestone,
    oldestMovie,
    longestRuntime,
    countryFirst,
    decadeFirst,
    firstGenre,
    tmdbDeviation,
  ],
  [WorkType.book]: [
    allTimeRecord,
    clubMilestone,
    pagesMilestone,
    divisiveRecord,
    yearRecord,
    authorRecord,
    oldestBook,
    longestBook,
  ],
};

const nounFor = (type: WorkType): string =>
  Object.values(CLUB_TYPE_CONFIG).find((config) => config.workType === type)?.noun ?? "work";

/**
 * Picks the single most interesting fact about a review, or undefined.
 *
 * A fact only needs the target to have a club average — i.e. at least one
 * member has scored it. We deliberately don't wait for *every* member: in some
 * clubs (e.g. book clubs) not everyone reviews every work, so gating on a full
 * house would suppress facts entirely. Most reviews won't produce one anyway;
 * that's by design.
 */
export function computeReviewFact(
  reviews: DetailedReviewListItem[],
  workId: string,
): ReviewFact | undefined {
  const target = reviews.find((review) => review.id === workId);
  if (!isDefined(target)) return undefined;

  const targetAverage = averageOf(target);
  if (!isDefined(targetAverage)) return undefined;

  const works = [...reviews].sort((a, b) => a.createdDate.localeCompare(b.createdDate));
  const position = works.findIndex((work) => work.id === target.id) + 1;

  const ctx: FactContext = {
    target,
    works,
    worksThrough: works.slice(0, position),
    scored: works.filter((work) => isDefined(averageOf(work))),
    position,
    targetAverage,
    targetDate: utcDate(target.createdDate),
    noun: nounFor(target.type),
  };

  for (const generate of FACT_GENERATORS[target.type]) {
    const result = generate(ctx);
    if (isDefined(result)) return result;
  }
  return undefined;
}
