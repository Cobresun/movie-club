import { z } from "zod";

import { ClubType, WorkType } from "./generated/db";

/**
 * Shapes for the site-wide observability dashboard (`/admin`).
 *
 * These are Zod schemas with the TypeScript types inferred from them, rather
 * than plain interfaces, because `metric_snapshot.metrics` is a jsonb column:
 * reading a snapshot back yields `unknown`, and parsing is the only way to
 * recover a typed value without an `as` cast.
 */

/** The time frames the dashboard can be viewed over. */
export const METRICS_RANGES = ["7d", "30d", "90d", "1y", "all"] as const;
export const metricsRangeSchema = z.enum(METRICS_RANGES);
export type MetricsRange = z.infer<typeof metricsRangeSchema>;

export const DEFAULT_METRICS_RANGE: MetricsRange = "30d";

/** Length of each bounded range, in days. `all` has no lower bound. */
export const RANGE_DAYS: Record<Exclude<MetricsRange, "all">, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "1y": 365,
};

export const bucketUnitSchema = z.enum(["day", "week", "month"]);
export type BucketUnit = z.infer<typeof bucketUnitSchema>;

/** How finely the activity chart slices each range: roughly 7–30 bars at every setting. */
export const RANGE_BUCKET: Record<MetricsRange, BucketUnit> = {
  "7d": "day",
  "30d": "day",
  "90d": "week",
  "1y": "month",
  all: "month",
};

/** A count over a rolling window, measured from "now" at query time. */
export const activityCountsSchema = z.object({
  last7Days: z.number(),
  last30Days: z.number(),
});
export type ActivityCounts = z.infer<typeof activityCountsSchema>;

/**
 * A proportion kept as its two parts rather than a pre-divided percentage.
 *
 * "62%" and "5 of 8" say very different things about how much to trust the
 * number, and on a site this size the denominator is routinely small enough
 * that the difference matters. The UI shows both.
 */
export const rateSchema = z.object({
  numerator: z.number(),
  denominator: z.number(),
});
export type Rate = z.infer<typeof rateSchema>;

/**
 * A count over the selected range beside the same count over the equally long
 * range just before it. `previous` is null for `all`, which has no "before".
 */
export const periodCountSchema = z.object({
  current: z.number(),
  previous: z.number().nullable(),
});
export type PeriodCount = z.infer<typeof periodCountSchema>;

export const pulseSchema = z.object({
  /** Clubs with at least one review, comment, or list item in the range. */
  activeClubs: periodCountSchema,
  /** Distinct people who created a review, comment, or list item in the range. */
  activeUsers: periodCountSchema,
  newUsers: periodCountSchema,
  /**
   * Clubs created in the range. Clubs predating {@link TRUSTED_CREATED_AT_SINCE}
   * carry a `created_at` backfilled from their earliest activity, so older
   * ranges are a floor rather than an exact count.
   */
  newClubs: periodCountSchema,
  reviews: periodCountSchema,
  comments: periodCountSchema,
});
export type Pulse = z.infer<typeof pulseSchema>;

/** One slice of the activity chart. `bucket` is the UTC start date of the slice. */
export const activityBucketSchema = z.object({
  bucket: z.string(),
  reviews: z.number(),
  comments: z.number(),
  listAdds: z.number(),
});
export type ActivityBucket = z.infer<typeof activityBucketSchema>;

/**
 * Every club, sorted by how recently anything happened in it. Independent of
 * the selected range: this is where the club population stands today.
 */
export const clubStatusSchema = z.object({
  /** Activity in the last 30 days. */
  active: z.number(),
  /** Last activity 30–90 days ago. */
  quiet: z.number(),
  /** Nothing for more than 90 days. */
  dormant: z.number(),
  /** Never logged a review, comment, or list item. */
  neverStarted: z.number(),
  /** Clubs with no members at all, whatever their status. */
  empty: z.number(),
});
export type ClubStatus = z.infer<typeof clubStatusSchema>;

export const siteHealthSchema = z.object({
  /**
   * People who signed in over the last 30 days, and how many of them wrote
   * anything. Fixed to 30 days because sign-ins come from sessions, which
   * expire and are deleted, so a longer window would undercount.
   */
  contribution: rateSchema,
  /** People who signed up in the range, and how many have done anything at all. */
  newUserActivation: rateSchema,
  /** Works reviewed in the range, and how many of those drew a comment. */
  discussion: rateSchema,
  clubStatus: clubStatusSchema,
});
export type SiteHealth = z.infer<typeof siteHealthSchema>;

/**
 * The date from which `club.created_at` reflects an actual creation event.
 *
 * Clubs predating the observability migration carry a value backfilled from
 * their first review or list item, which is a floor, not a creation time.
 */
export const TRUSTED_CREATED_AT_SINCE = "2026-07-29";

/**
 * A title aggregated across every club that has it. Each club holds its own
 * `work` row, so the same movie in three clubs is three rows sharing an
 * external id; `key` is that shared identity.
 */
export const workSummarySchema = z.object({
  key: z.string(),
  title: z.string(),
  type: z.nativeEnum(WorkType),
  imageUrl: z.string().nullable(),
  clubs: z.number(),
});

export const reviewedWorkSchema = workSummarySchema.extend({
  reviews: z.number(),
  averageScore: z.number(),
  /** Standard deviation of the scores — how much reviewers disagreed. */
  spread: z.number(),
});
export type ReviewedWork = z.infer<typeof reviewedWorkSchema>;

export const wantedWorkSchema = workSummarySchema.extend({
  /** Times added to a club's own lists (not the reviews list) in the range. */
  adds: z.number(),
});
export type WantedWork = z.infer<typeof wantedWorkSchema>;

export const workLeaderboardsSchema = z.object({
  mostReviewed: z.array(reviewedWorkSchema),
  highestRated: z.array(reviewedWorkSchema),
  mostDivisive: z.array(reviewedWorkSchema),
  mostWanted: z.array(wantedWorkSchema),
});
export type WorkLeaderboards = z.infer<typeof workLeaderboardsSchema>;

export const clubRowSchema = z.object({
  clubId: z.string(),
  name: z.string(),
  slug: z.string(),
  type: z.nativeEnum(ClubType),
  /**
   * Who the members are. A count alone doesn't distinguish a club of four
   * strangers from four people you recognise, which on a site this size is the
   * more useful reading.
   */
  memberNames: z.array(z.string()),
  /** Reviews in the selected range. */
  reviews: z.number(),
  /** Reviews, comments, and list items in the selected range. */
  events: z.number(),
  /** Most recent activity of any kind, ever; null when the club has never done anything. */
  lastActiveAt: z.string().nullable(),
  createdAt: z.string().nullable(),
});
export type ClubRow = z.infer<typeof clubRowSchema>;

export const personRowSchema = z.object({
  userId: z.string(),
  name: z.string(),
  image: z.string().nullable(),
  reviews: z.number(),
  comments: z.number(),
  listAdds: z.number(),
  /** Distinct clubs the person belongs to. */
  clubs: z.number(),
  /** Most recent activity of any kind, ever; null when they have never done anything. */
  lastActiveAt: z.string().nullable(),
  joinedAt: z.string(),
});
export type PersonRow = z.infer<typeof personRowSchema>;

export const feedEventSchema = z.object({
  kind: z.enum(["review", "comment"]),
  at: z.string(),
  userName: z.string(),
  userImage: z.string().nullable(),
  clubName: z.string(),
  clubSlug: z.string(),
  workTitle: z.string(),
  workImageUrl: z.string().nullable(),
  /** The score given, for a review. */
  score: z.number().nullable(),
});
export type FeedEvent = z.infer<typeof feedEventSchema>;

export const adminDashboardSchema = z.object({
  generatedAt: z.string(),
  range: metricsRangeSchema,
  pulse: pulseSchema,
  activity: z.object({
    unit: bucketUnitSchema,
    buckets: z.array(activityBucketSchema),
  }),
  health: siteHealthSchema,
  works: workLeaderboardsSchema,
  clubs: z.object({
    /** Clubs ranked by reviews in the range, then by all activity. */
    busiest: z.array(clubRowSchema),
    /** Clubs created in the range, newest first. */
    newest: z.array(clubRowSchema),
  }),
  people: z.object({
    /** People ranked by activity in the range; counts are for the range. */
    mostActive: z.array(personRowSchema),
    /** People who signed up in the range, newest first; counts are all-time. */
    newest: z.array(personRowSchema),
  }),
  /** The latest reviews and comments, regardless of range. */
  feed: z.array(feedEventSchema),
});
export type AdminDashboard = z.infer<typeof adminDashboardSchema>;

/**
 * What the daily snapshot job records, and the subset the history chart reads.
 *
 * Zod strips unknown keys instead of rejecting them, so snapshots written with
 * extra fields — including every snapshot captured before this shape was
 * narrowed — keep parsing. Treat these fields as a compatibility contract.
 *
 * **Every field added here must be optional.** A required field retroactively
 * invalidates every snapshot captured before it existed — `safeParse` fails and
 * `getSnapshots` drops the row, silently erasing the history this table exists
 * to preserve. Optional is what makes widening safe; readers handle the gap.
 */
export const snapshotHistoryMetricsSchema = z.object({
  totals: z.object({
    users: z.number(),
    clubs: z.number(),
    reviews: z.number(),
  }),
  engagedUsers: activityCountsSchema,
  /**
   * Distinct users with a session created in the window. Better Auth prunes
   * expired sessions, so this number is gone from the live tables within weeks;
   * the snapshot is the only lasting record of it.
   */
  loggedInUsers: activityCountsSchema,
  activeClubs: activityCountsSchema,

  /** Absent from snapshots captured before these were added. */
  health: z
    .object({
      newUserActivation: rateSchema,
      unverifiedUsers: z.number(),
      dormantClubs: rateSchema,
    })
    .optional(),
});
export type SnapshotMetrics = z.infer<typeof snapshotHistoryMetricsSchema>;

export const snapshotHistoryPointSchema = z.object({
  capturedOn: z.string(),
  metrics: snapshotHistoryMetricsSchema,
});
export type SnapshotHistoryPoint = z.infer<typeof snapshotHistoryPointSchema>;
