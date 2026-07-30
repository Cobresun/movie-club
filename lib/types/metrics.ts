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

export const topClubSchema = z.object({
  clubId: z.string(),
  name: z.string(),
  slug: z.string(),
  type: z.nativeEnum(ClubType),
  memberCount: z.number(),
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

  topClubs: z.array(topClubSchema),
});
export type SiteMetrics = z.infer<typeof siteMetricsSchema>;

/**
 * The subset of a snapshot the history charts read.
 *
 * Deliberately narrower than {@link siteMetricsSchema}: Zod strips unknown keys
 * instead of rejecting them, so snapshots written before a new metric was added
 * keep parsing. Widening this schema invalidates accumulated history, so treat
 * these fields as a compatibility contract.
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
});
export type SnapshotHistoryMetrics = z.infer<typeof snapshotHistoryMetricsSchema>;

export const snapshotHistoryPointSchema = z.object({
  capturedOn: z.string(),
  metrics: snapshotHistoryMetricsSchema,
});
export type SnapshotHistoryPoint = z.infer<typeof snapshotHistoryPointSchema>;
