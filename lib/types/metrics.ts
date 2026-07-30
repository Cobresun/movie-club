import { z } from "zod";

import { ClubType } from "./generated/db";

/**
 * Shapes for the site-wide observability dashboard (`/admin`).
 *
 * These are Zod schemas with the TypeScript types inferred from them, rather
 * than plain interfaces, because `metric_snapshot.metrics` is a jsonb column:
 * reading a snapshot back yields `unknown`, and parsing is the only way to
 * recover a typed value without an `as` cast.
 */

/** A count over a rolling window, measured from "now" at query time. */
export const activityCountsSchema = z.object({
  last7Days: z.number(),
  last30Days: z.number(),
});
export type ActivityCounts = z.infer<typeof activityCountsSchema>;

/** One bucket of a weekly time series. `weekStart` is the UTC Monday, ISO date. */
export const timeSeriesPointSchema = z.object({
  weekStart: z.string(),
  count: z.number(),
});
export type TimeSeriesPoint = z.infer<typeof timeSeriesPointSchema>;

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

/** One bucket of the club-size histogram. */
export const clubSizeBucketSchema = z.object({
  label: z.string(),
  clubs: z.number(),
});
export type ClubSizeBucket = z.infer<typeof clubSizeBucketSchema>;

/**
 * Users holding an account with one auth provider.
 *
 * Counts are per provider, not per user: someone who signed up with a password
 * and later linked Google holds two `account` rows and appears in both buckets,
 * so these do not sum to the user total.
 */
export const signupMethodSchema = z.object({
  provider: z.string(),
  users: z.number(),
});
export type SignupMethod = z.infer<typeof signupMethodSchema>;

/**
 * Operational health — the numbers that say whether the product is working,
 * as opposed to how big it is.
 */
export const siteHealthSchema = z.object({
  /** Users who signed up in the last 30 days, and how many did anything at all. */
  newUserActivation: rateSchema,

  /** Users who never verified their email — people stranded partway through signup. */
  unverifiedUsers: z.number(),

  /** Clubs that have had activity at some point, and how many have had none recently. */
  dormantClubs: rateSchema,

  /**
   * Median days between a club being created and its first review.
   *
   * Measured only over clubs created after {@link TRUSTED_CREATED_AT_SINCE}.
   * Older clubs had `created_at` backfilled *from* their earliest review, which
   * would score them all at roughly zero days and drag the median to a number
   * that describes the migration rather than the product. Null until enough
   * genuinely-dated clubs exist.
   */
  medianDaysToFirstReview: z.number().nullable(),

  /** How many clubs the median is drawn from, so the UI can refuse to show a median of two. */
  daysToFirstReviewSample: z.number(),

  /** Clubs with at least one user-defined (non-system) list. */
  customListAdoption: rateSchema,

  /** Works carrying at least one review, and how many of those also drew a comment. */
  commentedWorks: rateSchema,

  clubSizes: z.array(clubSizeBucketSchema),
  signupMethods: z.array(signupMethodSchema),
});
export type SiteHealth = z.infer<typeof siteHealthSchema>;

/**
 * The date from which `club.created_at` reflects an actual creation event.
 *
 * Clubs predating the observability migration carry a value backfilled from
 * their first review or list item, which is a floor, not a creation time. Any
 * metric measuring an interval *from* club creation has to start here.
 */
export const TRUSTED_CREATED_AT_SINCE = "2026-07-29";

/** A member of the most-active-users leaderboard. Admin-only surface, so names are shown. */
export const activeUserSchema = z.object({
  userId: z.string(),
  name: z.string(),
  image: z.string().nullable(),
  reviews: z.number(),
  comments: z.number(),
  listAdds: z.number(),
  /** Sum of the three, which is also the sort key. */
  total: z.number(),
  /** Distinct clubs the user was active in. */
  clubs: z.number(),
  lastActive: z.string(),
});
export type ActiveUser = z.infer<typeof activeUserSchema>;

export const topClubSchema = z.object({
  clubId: z.string(),
  name: z.string(),
  slug: z.string(),
  type: z.nativeEnum(ClubType),
  memberCount: z.number(),
  /**
   * Who the members actually are. The count alone doesn't distinguish a club of
   * four strangers from four people you recognise, which on a site this size is
   * the more useful reading.
   */
  memberNames: z.array(z.string()),
  reviewCount: z.number(),
  /** Null for clubs whose creation date could not be backfilled (no activity). */
  createdAt: z.string().nullable(),
});
export type TopClub = z.infer<typeof topClubSchema>;

export const siteMetricsSchema = z.object({
  /** When this bundle was computed. Snapshots keep the capture time here. */
  generatedAt: z.string(),

  totals: z.object({
    users: z.number(),
    verifiedUsers: z.number(),
    clubs: z.number(),
    movieClubs: z.number(),
    bookClubs: z.number(),
    memberships: z.number(),
    reviews: z.number(),
    comments: z.number(),
    works: z.number(),
    lists: z.number(),
  }),

  newUsers: activityCountsSchema,

  /**
   * Clubs created in the window. Clubs predating 2026-07-29 carry a `created_at`
   * backfilled from their earliest review or list item, so historical buckets are
   * a floor rather than an exact count; clubs with no activity to date them by
   * are NULL and are excluded entirely rather than counted as recent.
   */
  newClubs: activityCountsSchema,

  /**
   * Distinct users who created a review, comment, or list item in the window.
   * This is the durable engagement signal — it is reconstructible from content
   * tables at any time.
   */
  engagedUsers: activityCountsSchema,

  /**
   * Distinct users with a session created in the window. Better Auth prunes
   * expired sessions, so this metric silently loses history in the live tables;
   * `metric_snapshot` is what makes it trustworthy over time.
   */
  loggedInUsers: activityCountsSchema,

  /** Clubs with at least one review, comment, or list item in the window. */
  activeClubs: activityCountsSchema,

  weekly: z.object({
    users: z.array(timeSeriesPointSchema),
    clubs: z.array(timeSeriesPointSchema),
    reviews: z.array(timeSeriesPointSchema),
  }),

  health: siteHealthSchema,

  topClubs: z.array(topClubSchema),

  /** Busiest people over the last 30 days, by activity-event count. */
  topUsers: z.array(activeUserSchema),
});
export type SiteMetrics = z.infer<typeof siteMetricsSchema>;

/**
 * The subset of a snapshot the history charts read.
 *
 * Deliberately narrower than {@link siteMetricsSchema}: Zod strips unknown keys
 * instead of rejecting them, so snapshots written before a new metric was added
 * keep parsing. Treat these fields as a compatibility contract.
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
  loggedInUsers: activityCountsSchema,
  activeClubs: activityCountsSchema,

  /**
   * The health metrics whose movement over time is the point — an activation
   * rate or a dormant-club count is nearly meaningless as a single reading.
   * Absent from snapshots captured before this was added.
   */
  health: z
    .object({
      newUserActivation: rateSchema,
      unverifiedUsers: z.number(),
      dormantClubs: rateSchema,
    })
    .optional(),
});
export type SnapshotHistoryMetrics = z.infer<typeof snapshotHistoryMetricsSchema>;

export const snapshotHistoryPointSchema = z.object({
  capturedOn: z.string(),
  metrics: snapshotHistoryMetricsSchema,
});
export type SnapshotHistoryPoint = z.infer<typeof snapshotHistoryPointSchema>;
