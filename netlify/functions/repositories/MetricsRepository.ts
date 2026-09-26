import { Expression, ExpressionBuilder, InferResult, QueryCreator, sql } from "kysely";

import { isDefined } from "../../../lib/checks/checks.js";
import { DB, Json, WorkType } from "../../../lib/types/generated/db.js";
import {
  ActivityBucket,
  AdminDashboard,
  BucketUnit,
  ClubRow,
  ClubStatus,
  clubRowSchema,
  FeedEvent,
  MetricsRange,
  PeriodCount,
  PersonRow,
  RANGE_BUCKET,
  RANGE_DAYS,
  Rate,
  ReviewedWork,
  reviewedWorkSchema,
  SnapshotHistoryPoint,
  SnapshotMetrics,
  snapshotHistoryMetricsSchema,
  WantedWork,
  wantedWorkSchema,
} from "../../../lib/types/metrics.js";
import { db } from "../utils/database";
import { fillBuckets } from "../utils/timeBuckets";

/** Rows per leaderboard. */
const LEADERBOARD_LIMIT = 10;

/** Entries in the latest-activity feed. */
const FEED_LIMIT = 12;

/**
 * Fewer reviews than this and an average or a spread says more about one
 * person's taste than about the title, so the rated and divisive boards skip it.
 */
const MIN_REVIEWS_TO_RANK = 3;

/** A club with activity this recently is active; the metric the dashboard leads with. */
const ACTIVE_DAYS = 30;

/**
 * Silence after which a club counts as dormant. Deliberately longer than the
 * active window: clubs meet on their own cadence, and a club that skips a
 * month is on a break, not lost — those are "quiet".
 */
const DORMANCY_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Stands in for "no lower bound" so the `all` range runs the same queries as the rest. */
const BEGINNING_OF_TIME = new Date(0);

/**
 * Postgres `count()` is `int8`, and node-postgres hands `int8` back as a
 * *string* rather than a number so that values past 2^53 don't lose precision.
 * Every aggregate in this file goes through here, because an unconverted count
 * reaches the dashboard as `"12"` and turns `total + total` into `"1212"` —
 * a bug that type-checks, lints, and renders without complaint.
 */
function toCount(value: string | number | bigint | null | undefined): number {
  return isDefined(value) ? Number(value) : 0;
}

function daysAgo(days: number, now: number = Date.now()): Date {
  return new Date(now - days * DAY_MS);
}

/** UTC calendar date, `YYYY-MM-DD`. */
function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/** Aggregates over a union can come back as a string rather than a Date. */
function toIsoTimestamp(value: Date | string | null | undefined): string | null {
  return isDefined(value) ? new Date(value).toISOString() : null;
}

/**
 * The selected range, resolved against one `now` so every query in a request
 * agrees on where it starts. `previousSince` opens the equally long range just
 * before it, for the period-over-period comparison; `all` has none.
 */
interface RangeWindow {
  unit: BucketUnit;
  now: Date;
  since: Date;
  previousSince: Date | undefined;
}

function rangeWindow(range: MetricsRange): RangeWindow {
  const now = Date.now();
  const unit = RANGE_BUCKET[range];
  if (range === "all") {
    return { unit, now: new Date(now), since: BEGINNING_OF_TIME, previousSince: undefined };
  }
  const days = RANGE_DAYS[range];
  return {
    unit,
    now: new Date(now),
    since: daysAgo(days, now),
    previousSince: daysAgo(days * 2, now),
  };
}

type ActivityKind = "review" | "comment" | "list_add";

/**
 * Every user-attributable content event, normalised to `(user_id, club_id, ts, kind)`,
 * as a CTE the activity queries below mount with `.with("activity", activityEvents)`.
 *
 * Reviews and list items reach their club through `work_list`; comments carry
 * `club_id` directly. `work_list_item.added_by_user_id` is nullable for rows
 * added before that column existed, which is harmless for the distinct counts
 * because `count(DISTINCT …)` ignores NULLs — those rows still count toward club
 * activity, just not toward any user's engagement. Queries that group *by* user
 * exclude them explicitly.
 *
 * The list-item branch leads deliberately, because a UNION takes each column's
 * type from its first branch and that branch is the one telling the truth about
 * both awkward columns:
 *
 * - `added_by_user_id` is the only nullable `user_id` of the three, so leading
 *   with it gives the CTE an honestly nullable column instead of a cast that
 *   would hide the NULLs from the type system.
 * - `kind` needs an explicit `::text`; an uncast string literal in the leading
 *   branch is `unknown` rather than `text`, which makes a `filterWhere` on
 *   `kind` ambiguous.
 */
function activityEvents(qc: QueryCreator<DB>) {
  return qc
    .selectFrom("work_list_item")
    .innerJoin("work_list", "work_list.id", "work_list_item.list_id")
    .select([
      "work_list_item.added_by_user_id as user_id",
      "work_list.club_id as club_id",
      "work_list_item.time_added as ts",
      sql<ActivityKind>`${sql.lit("list_add")}::text`.as("kind"),
    ])
    .unionAll(
      qc
        .selectFrom("review")
        .innerJoin("work_list", "work_list.id", "review.list_id")
        .select([
          "review.user_id as user_id",
          "work_list.club_id as club_id",
          "review.created_date as ts",
          sql<ActivityKind>`${sql.lit("review")}`.as("kind"),
        ]),
    )
    .unionAll(
      qc
        .selectFrom("work_comment")
        .select([
          "work_comment.user_id as user_id",
          "work_comment.club_id as club_id",
          "work_comment.created_date as ts",
          sql<ActivityKind>`${sql.lit("comment")}`.as("kind"),
        ]),
    );
}

/**
 * `to_char(date_trunc(unit, …))`, with the column passed in as a checked
 * expression. Formatting in the database keeps the bucket key clear of any JS
 * timezone conversion on the way out. `unit` is inlined as a literal rather
 * than bound, so the expression is textually identical wherever it appears.
 */
function bucketOf(unit: BucketUnit, column: Expression<Date>) {
  return sql<string>`to_char(date_trunc(${sql.lit(unit)}, ${column}), 'YYYY-MM-DD')`;
}

/**
 * The identity a title shares across clubs. Every club holds its own `work`
 * row, so the same film in three clubs is three rows with one external id;
 * grouping on this collapses them. A work with no external id is only ever
 * itself.
 */
function workKey(eb: ExpressionBuilder<DB, "work">) {
  return eb.fn.coalesce("work.external_id", eb.cast<string>("work.id", "text"));
}

/** The row shape of {@link activityEvents}, for the CTEs built on top of it. */
type ActivityRow = InferResult<ReturnType<typeof activityEvents>>[number];

class MetricsRepository {
  /**
   * Distinct clubs and people active in `[from, until)`, plus reviews and
   * comments, from one pass over the activity union.
   *
   * One query per window, with the window in `WHERE`, on purpose: CockroachDB
   * returns wrong answers — often 0 — when a single SELECT holds several
   * `count(DISTINCT x)` over the same column with different `FILTER` clauses
   * (or one filtered and one not). Two windows in one SELECT is exactly that
   * shape, and it is how the dashboard once reported one active club while
   * its own leaderboard listed four. Never pair `.distinct()` with
   * `.filterWhere()`.
   */
  private async countActivity(from: Date, until: Date) {
    const row = await db
      .with("activity", activityEvents)
      .selectFrom("activity")
      .where("ts", ">=", from)
      .where("ts", "<", until)
      .select((eb) => [
        eb.fn.count<string>("club_id").distinct().as("clubs"),
        eb.fn.count<string>("user_id").distinct().as("users"),
        eb.fn.countAll<string>().filterWhere("kind", "=", "review").as("reviews"),
        eb.fn.countAll<string>().filterWhere("kind", "=", "comment").as("comments"),
      ])
      .executeTakeFirstOrThrow();

    return {
      clubs: toCount(row.clubs),
      users: toCount(row.users),
      reviews: toCount(row.reviews),
      comments: toCount(row.comments),
    };
  }

  /** The headline counts for the range and for the range before it. */
  private async getPulse(window: RangeWindow) {
    const { since } = window;
    const previousSince = window.previousSince ?? since;

    const [current, previous, signups] = await Promise.all([
      this.countActivity(since, window.now),
      window.previousSince === undefined ? undefined : this.countActivity(previousSince, since),
      db
        .selectNoFrom((eb) => [
          eb
            .selectFrom("user")
            .where("createdAt", ">=", since)
            .select((e) => e.fn.countAll<string>().as("c"))
            .as("users_now"),
          eb
            .selectFrom("user")
            .where("createdAt", ">=", previousSince)
            .where("createdAt", "<", since)
            .select((e) => e.fn.countAll<string>().as("c"))
            .as("users_before"),
          eb
            .selectFrom("club")
            .where("created_at", ">=", since)
            .select((e) => e.fn.countAll<string>().as("c"))
            .as("clubs_now"),
          eb
            .selectFrom("club")
            .where("created_at", ">=", previousSince)
            .where("created_at", "<", since)
            .select((e) => e.fn.countAll<string>().as("c"))
            .as("clubs_before"),
        ])
        .executeTakeFirstOrThrow(),
    ]);

    const hasPrevious = previous !== undefined;
    const period = (now: number, before: number | undefined): PeriodCount => ({
      current: now,
      previous: hasPrevious ? (before ?? 0) : null,
    });

    return {
      activeClubs: period(current.clubs, previous?.clubs),
      activeUsers: period(current.users, previous?.users),
      newUsers: period(toCount(signups.users_now), toCount(signups.users_before)),
      newClubs: period(toCount(signups.clubs_now), toCount(signups.clubs_before)),
      reviews: period(current.reviews, previous?.reviews),
      comments: period(current.comments, previous?.comments),
    };
  }

  /** Reviews, comments, and list adds per day, week, or month across the range. */
  private async getActivityBuckets(window: RangeWindow): Promise<ActivityBucket[]> {
    const rows = await db
      .with("activity", activityEvents)
      .selectFrom("activity")
      .where("ts", ">=", window.since)
      .select((eb) => [
        bucketOf(window.unit, eb.ref("ts")).as("bucket"),
        eb.fn.countAll<string>().filterWhere("kind", "=", "review").as("reviews"),
        eb.fn.countAll<string>().filterWhere("kind", "=", "comment").as("comments"),
        eb.fn.countAll<string>().filterWhere("kind", "=", "list_add").as("list_adds"),
      ])
      .groupBy("bucket")
      .orderBy("bucket")
      .execute();

    const buckets = rows.map((row) => ({
      bucket: row.bucket,
      reviews: toCount(row.reviews),
      comments: toCount(row.comments),
      listAdds: toCount(row.list_adds),
    }));

    // `all` starts wherever the data does; the bounded ranges start at their
    // own edge so a quiet opening stretch still draws as empty bars.
    const from =
      window.previousSince === undefined && buckets.length > 0
        ? new Date(`${buckets[0].bucket}T00:00:00Z`)
        : window.previousSince === undefined
          ? window.now
          : window.since;

    return fillBuckets(window.unit, from, window.now, buckets, (bucket) => ({
      bucket,
      reviews: 0,
      comments: 0,
      listAdds: 0,
    }));
  }

  /**
   * Every club placed by how recently anything happened in it.
   *
   * Measured over all activity rather than reviews alone: a club still adding
   * to its watchlist is alive even if nobody has scored anything.
   */
  private async getClubStatus(): Promise<ClubStatus> {
    const activeSince = daysAgo(ACTIVE_DAYS);
    const dormantBefore = daysAgo(DORMANCY_DAYS);

    const [status, empty] = await Promise.all([
      db
        .with("activity", activityEvents)
        .with("club_last_seen", (qc) =>
          qc
            .selectFrom("activity")
            .select((eb) => ["club_id", eb.fn.max("ts").as("last_ts")])
            .where("club_id", "is not", null)
            .groupBy("club_id"),
        )
        .selectFrom("club")
        .leftJoin("club_last_seen", "club_last_seen.club_id", "club.id")
        .select((eb) => [
          eb.fn
            .countAll<string>()
            .filterWhere("club_last_seen.last_ts", ">=", activeSince)
            .as("active"),
          eb.fn
            .countAll<string>()
            .filterWhere(
              eb.and([
                eb("club_last_seen.last_ts", "<", activeSince),
                eb("club_last_seen.last_ts", ">=", dormantBefore),
              ]),
            )
            .as("quiet"),
          eb.fn
            .countAll<string>()
            .filterWhere("club_last_seen.last_ts", "<", dormantBefore)
            .as("dormant"),
          eb.fn
            .countAll<string>()
            .filterWhere("club_last_seen.last_ts", "is", null)
            .as("never_started"),
        ])
        .executeTakeFirstOrThrow(),
      db
        .selectFrom("club")
        .leftJoin("club_member", "club_member.club_id", "club.id")
        .where("club_member.user_id", "is", null)
        .select((eb) => eb.fn.countAll<string>().as("c"))
        .executeTakeFirstOrThrow(),
    ]);

    return {
      active: toCount(status.active),
      quiet: toCount(status.quiet),
      dormant: toCount(status.dormant),
      neverStarted: toCount(status.never_started),
      empty: toCount(empty.c),
    };
  }

  /**
   * Of the people who showed up in the last 30 days, how many wrote anything.
   *
   * A session counts if it was created or refreshed in the window, so someone
   * who has stayed signed in all month is still a visitor.
   */
  private async getContribution(): Promise<Rate> {
    const since = daysAgo(ACTIVE_DAYS);

    const row = await db
      .with("activity", activityEvents)
      .with("visitors", (qc) =>
        qc
          .selectFrom("session")
          .select("userId")
          .where((eb) => eb.or([eb("createdAt", ">=", since), eb("updatedAt", ">=", since)]))
          .distinct(),
      )
      .selectNoFrom((eb) => [
        eb
          .selectFrom("visitors")
          .select((e) => e.fn.countAll<string>().as("c"))
          .as("visitors"),
        eb
          .selectFrom("visitors")
          .where((e) =>
            e.exists(
              e
                .selectFrom("activity")
                .whereRef("activity.user_id", "=", "visitors.userId")
                .where("activity.ts", ">=", since)
                .select(e.lit(1).as("one")),
            ),
          )
          .select((e) => e.fn.countAll<string>().as("c"))
          .as("contributors"),
      ])
      .executeTakeFirstOrThrow();

    return { numerator: toCount(row.contributors), denominator: toCount(row.visitors) };
  }

  /**
   * Do signups become users? Counts people who joined since `since` and how
   * many of them have done anything at all.
   *
   * `EXISTS` rather than a join or an `IN`: the question is only whether a user
   * appears in the activity set, and stopping at the first match avoids
   * aggregating every event belonging to a prolific new member.
   */
  private async getActivation(since: Date): Promise<Rate> {
    const row = await db
      .with("activity", activityEvents)
      .with("recent_users", (qc) =>
        qc.selectFrom("user").select("id").where("createdAt", ">=", since),
      )
      .selectNoFrom((eb) => [
        eb
          .selectFrom("recent_users")
          .select((e) => e.fn.countAll<string>().as("c"))
          .as("signups"),
        eb
          .selectFrom("recent_users")
          .where((e) =>
            e.exists(
              e
                .selectFrom("activity")
                .whereRef("activity.user_id", "=", "recent_users.id")
                .select(e.lit(1).as("one")),
            ),
          )
          .select((e) => e.fn.countAll<string>().as("c"))
          .as("activated"),
      ])
      .executeTakeFirstOrThrow();

    return { numerator: toCount(row.activated), denominator: toCount(row.signups) };
  }

  /** Works reviewed in the range, and how many of them anybody talked about. */
  private async getDiscussion(since: Date): Promise<Rate> {
    const row = await db
      .with("reviewed", (qc) =>
        qc.selectFrom("review").select("work_id").where("created_date", ">=", since).distinct(),
      )
      .selectNoFrom((eb) => [
        eb
          .selectFrom("reviewed")
          .select((e) => e.fn.countAll<string>().as("c"))
          .as("reviewed"),
        eb
          .selectFrom("reviewed")
          .where((e) =>
            e.exists(
              e
                .selectFrom("work_comment")
                .whereRef("work_comment.work_id", "=", "reviewed.work_id")
                .select(e.lit(1).as("one")),
            ),
          )
          .select((e) => e.fn.countAll<string>().as("c"))
          .as("discussed"),
      ])
      .executeTakeFirstOrThrow();

    return { numerator: toCount(row.discussed), denominator: toCount(row.reviewed) };
  }

  /** Reviews in the range grouped by title across clubs; each board orders and trims it. */
  private reviewedWorks(since: Date) {
    return db
      .selectFrom("review")
      .innerJoin("work", "work.id", "review.work_id")
      .where("review.created_date", ">=", since)
      .select((eb) => [
        "work.type",
        workKey(eb).as("work_key"),
        eb.fn.max("work.title").as("title"),
        eb.fn.max("work.image_url").as("image_url"),
        eb.fn.count<string>("work.club_id").distinct().as("clubs"),
        eb.fn.countAll<string>().as("reviews"),
        eb.fn.avg<string>("review.score").as("average_score"),
        eb.fn<string | null>("stddev_pop", ["review.score"]).as("spread"),
      ])
      .groupBy(["work.type", "work_key"]);
  }

  private toReviewedWork(row: {
    type: WorkType;
    work_key: string;
    title: string;
    image_url: string | null;
    clubs: string;
    reviews: string;
    average_score: string;
    spread: string | null;
  }): ReviewedWork {
    return reviewedWorkSchema.parse({
      key: `${row.type}:${row.work_key}`,
      title: row.title,
      type: row.type,
      imageUrl: row.image_url,
      clubs: toCount(row.clubs),
      reviews: toCount(row.reviews),
      averageScore: Number(row.average_score),
      spread: toCount(row.spread),
    });
  }

  private async getWorkLeaderboards(since: Date) {
    const base = this.reviewedWorks(since);
    const rankable = base.having((eb) => eb.fn.countAll(), ">=", MIN_REVIEWS_TO_RANK);

    const [mostReviewed, highestRated, mostDivisive, mostWanted] = await Promise.all([
      base
        .orderBy("reviews", "desc")
        .orderBy("average_score", "desc")
        .limit(LEADERBOARD_LIMIT)
        .execute(),
      rankable
        .orderBy("average_score", "desc")
        .orderBy("reviews", "desc")
        .limit(LEADERBOARD_LIMIT)
        .execute(),
      rankable
        .orderBy("spread", "desc")
        .orderBy("reviews", "desc")
        .limit(LEADERBOARD_LIMIT)
        .execute(),
      this.getMostWanted(since),
    ]);

    return {
      mostReviewed: mostReviewed.map((row) => this.toReviewedWork(row)),
      highestRated: highestRated.map((row) => this.toReviewedWork(row)),
      mostDivisive: mostDivisive.map((row) => this.toReviewedWork(row)),
      mostWanted,
    };
  }

  /**
   * Titles clubs queued up in the range. Only a club's own lists count — a
   * work lands on the reviews list when it is watched, which is the other
   * leaderboards' business — and a title moves off its watch list once it is
   * reviewed, so this reads as "wanted and not yet seen".
   */
  private async getMostWanted(since: Date): Promise<WantedWork[]> {
    const rows = await db
      .selectFrom("work_list_item")
      .innerJoin("work_list", "work_list.id", "work_list_item.list_id")
      .innerJoin("work", "work.id", "work_list_item.work_id")
      .where("work_list.system_type", "is", null)
      .where("work_list_item.time_added", ">=", since)
      .select((eb) => [
        "work.type",
        workKey(eb).as("work_key"),
        eb.fn.max("work.title").as("title"),
        eb.fn.max("work.image_url").as("image_url"),
        eb.fn.count<string>("work.club_id").distinct().as("clubs"),
        eb.fn.countAll<string>().as("adds"),
      ])
      .groupBy(["work.type", "work_key"])
      .orderBy("clubs", "desc")
      .orderBy("adds", "desc")
      .limit(LEADERBOARD_LIMIT)
      .execute();

    return rows.map((row) =>
      wantedWorkSchema.parse({
        key: `${row.type}:${row.work_key}`,
        title: row.title,
        type: row.type,
        imageUrl: row.image_url,
        clubs: toCount(row.clubs),
        adds: toCount(row.adds),
      }),
    );
  }

  /** Per-club activity since `since`, as a CTE the club leaderboards join against. */
  private clubActivity(since: Date) {
    return (qc: QueryCreator<DB & { activity: ActivityRow }>) =>
      qc
        .selectFrom("activity")
        .where("club_id", "is not", null)
        .where("ts", ">=", since)
        .select((eb) => [
          "club_id",
          eb.fn.countAll<string>().filterWhere("kind", "=", "review").as("reviews"),
          eb.fn.countAll<string>().as("events"),
          eb.fn.max("ts").as("last_ts"),
        ])
        .groupBy("club_id");
  }

  /** Clubs ranked by reviews in the range, then by everything else they did. */
  private async getBusiestClubs(since: Date): Promise<ClubRow[]> {
    const rows = await db
      .with("activity", activityEvents)
      .with("club_activity", this.clubActivity(since))
      .selectFrom("club_activity")
      .innerJoin("club", "club.id", "club_activity.club_id")
      .select([
        "club.id",
        "club.name",
        "club.slug",
        "club.type",
        "club.created_at",
        "club_activity.reviews",
        "club_activity.events",
        "club_activity.last_ts",
      ])
      .orderBy("club_activity.reviews", "desc")
      .orderBy("club_activity.events", "desc")
      .limit(LEADERBOARD_LIMIT)
      .execute();

    return this.toClubRows(rows);
  }

  /** Clubs created in the range, with everything they have done since. */
  private async getNewestClubs(since: Date): Promise<ClubRow[]> {
    const rows = await db
      .with("activity", activityEvents)
      .with("club_activity", this.clubActivity(BEGINNING_OF_TIME))
      .selectFrom("club")
      .leftJoin("club_activity", "club_activity.club_id", "club.id")
      .where("club.created_at", ">=", since)
      .select([
        "club.id",
        "club.name",
        "club.slug",
        "club.type",
        "club.created_at",
        "club_activity.reviews",
        "club_activity.events",
        "club_activity.last_ts",
      ])
      .orderBy("club.created_at", "desc")
      .limit(LEADERBOARD_LIMIT)
      .execute();

    return this.toClubRows(rows);
  }

  private async toClubRows(
    rows: {
      id: string;
      name: string;
      slug: string;
      type: string;
      created_at: Date | null;
      reviews: string | null;
      events: string | null;
      last_ts: Date | string | null;
    }[],
  ): Promise<ClubRow[]> {
    const memberNames = await this.getMemberNames(rows.map((row) => row.id));

    // Parsed rather than cast: `club.type` arrives as a plain string and
    // clubRowSchema's nativeEnum check is what makes it a ClubType.
    return rows.map((row) =>
      clubRowSchema.parse({
        clubId: String(row.id),
        name: row.name,
        slug: row.slug,
        type: row.type,
        memberNames: memberNames.get(String(row.id)) ?? [],
        reviews: toCount(row.reviews),
        events: toCount(row.events),
        lastActiveAt: toIsoTimestamp(row.last_ts),
        createdAt: toIsoTimestamp(row.created_at),
      }),
    );
  }

  /**
   * Member names for the leaderboard clubs, grouped by club.
   *
   * A follow-up query keyed on the ids the previous one returned, rather than a
   * join: the leaderboard is ten clubs, so this is one small indexed lookup, and
   * joining members into the club query would multiply its rows and break the
   * counts it already computes.
   */
  private async getMemberNames(clubIds: string[]): Promise<Map<string, string[]>> {
    const grouped = new Map<string, string[]>();
    if (clubIds.length === 0) {
      // `where in ()` is not valid SQL — Kysely would emit an empty list.
      return grouped;
    }

    const rows = await db
      .selectFrom("club_member")
      .innerJoin("user", "user.id", "club_member.user_id")
      // Explicit columns rather than selectAll(): both tables have columns that
      // would shadow each other under a joined selectAll.
      .select(["club_member.club_id", "user.name"])
      .where("club_member.club_id", "in", clubIds)
      .orderBy("user.name", "asc")
      .execute();

    for (const row of rows) {
      const key = String(row.club_id);
      const names = grouped.get(key);
      if (names === undefined) {
        grouped.set(key, [row.name]);
      } else {
        names.push(row.name);
      }
    }

    return grouped;
  }

  /**
   * Per-person activity since `since`, as a CTE the people leaderboards join
   * against. Broken down by kind because the breakdown matters more than the
   * total: forty comments and no reviews is a different person from the reverse.
   */
  private userActivity(since: Date) {
    return (qc: QueryCreator<DB & { activity: ActivityRow }>) =>
      qc
        .selectFrom("activity")
        // Drops the NULL-attribution list adds described on activityEvents.
        .where("user_id", "is not", null)
        .where("ts", ">=", since)
        .select((eb) => [
          "user_id",
          eb.fn.countAll<string>().as("events"),
          eb.fn.countAll<string>().filterWhere("kind", "=", "review").as("reviews"),
          eb.fn.countAll<string>().filterWhere("kind", "=", "comment").as("comments"),
          eb.fn.countAll<string>().filterWhere("kind", "=", "list_add").as("list_adds"),
          eb.fn.max("ts").as("last_ts"),
        ])
        .groupBy("user_id");
  }

  private async getMostActivePeople(since: Date): Promise<PersonRow[]> {
    const rows = await db
      .with("activity", activityEvents)
      .with("user_activity", this.userActivity(since))
      .selectFrom("user_activity")
      .innerJoin("user", "user.id", "user_activity.user_id")
      .select((eb) => [
        "user.id",
        "user.name",
        "user.image",
        "user.createdAt",
        "user_activity.reviews",
        "user_activity.comments",
        "user_activity.list_adds",
        "user_activity.last_ts",
        eb
          .selectFrom("club_member")
          .whereRef("club_member.user_id", "=", "user.id")
          .select((e) => e.fn.countAll<string>().as("c"))
          .as("clubs"),
      ])
      .orderBy("user_activity.events", "desc")
      .orderBy("user_activity.last_ts", "desc")
      .limit(LEADERBOARD_LIMIT)
      .execute();

    return rows.map((row) => this.toPersonRow(row));
  }

  /** People who signed up in the range, with everything they have done since. */
  private async getNewestPeople(since: Date): Promise<PersonRow[]> {
    const rows = await db
      .with("activity", activityEvents)
      .with("user_activity", this.userActivity(BEGINNING_OF_TIME))
      .selectFrom("user")
      .leftJoin("user_activity", "user_activity.user_id", "user.id")
      .where("user.createdAt", ">=", since)
      .select((eb) => [
        "user.id",
        "user.name",
        "user.image",
        "user.createdAt",
        "user_activity.reviews",
        "user_activity.comments",
        "user_activity.list_adds",
        "user_activity.last_ts",
        eb
          .selectFrom("club_member")
          .whereRef("club_member.user_id", "=", "user.id")
          .select((e) => e.fn.countAll<string>().as("c"))
          .as("clubs"),
      ])
      .orderBy("user.createdAt", "desc")
      .limit(LEADERBOARD_LIMIT)
      .execute();

    return rows.map((row) => this.toPersonRow(row));
  }

  private toPersonRow(row: {
    id: string;
    name: string;
    image: string | null;
    createdAt: Date;
    reviews: string | null;
    comments: string | null;
    list_adds: string | null;
    last_ts: Date | string | null;
    clubs: string | null;
  }): PersonRow {
    return {
      userId: String(row.id),
      name: row.name,
      image: row.image,
      reviews: toCount(row.reviews),
      comments: toCount(row.comments),
      listAdds: toCount(row.list_adds),
      clubs: toCount(row.clubs),
      lastActiveAt: toIsoTimestamp(row.last_ts),
      joinedAt: new Date(row.createdAt).toISOString(),
    };
  }

  /**
   * The latest reviews and comments, newest first. Two small ordered queries
   * merged here rather than a UNION: the score column exists on only one side,
   * and each query stops after {@link FEED_LIMIT} rows either way.
   *
   * Comment text is left out on purpose — this is a pulse on what is being
   * discussed, not a window into clubs' conversations.
   */
  private async getFeed(): Promise<FeedEvent[]> {
    const [reviews, comments] = await Promise.all([
      db
        .selectFrom("review")
        .innerJoin("work", "work.id", "review.work_id")
        .innerJoin("club", "club.id", "work.club_id")
        .innerJoin("user", "user.id", "review.user_id")
        .select([
          "review.created_date as at",
          "review.score",
          "user.name as user_name",
          "user.image as user_image",
          "club.name as club_name",
          "club.slug as club_slug",
          "work.title as work_title",
          "work.image_url as work_image_url",
        ])
        .orderBy("review.created_date", "desc")
        .limit(FEED_LIMIT)
        .execute(),
      db
        .selectFrom("work_comment")
        .innerJoin("work", "work.id", "work_comment.work_id")
        .innerJoin("club", "club.id", "work_comment.club_id")
        .innerJoin("user", "user.id", "work_comment.user_id")
        .select([
          "work_comment.created_date as at",
          "user.name as user_name",
          "user.image as user_image",
          "club.name as club_name",
          "club.slug as club_slug",
          "work.title as work_title",
          "work.image_url as work_image_url",
        ])
        .orderBy("work_comment.created_date", "desc")
        .limit(FEED_LIMIT)
        .execute(),
    ]);

    const shared = (row: (typeof comments)[number]) => ({
      at: new Date(row.at).toISOString(),
      userName: row.user_name,
      userImage: row.user_image,
      clubName: row.club_name,
      clubSlug: row.club_slug,
      workTitle: row.work_title,
      workImageUrl: row.work_image_url,
    });

    const events: FeedEvent[] = [
      ...reviews.map((row) => ({
        ...shared(row),
        kind: "review" as const,
        score: Number(row.score),
      })),
      ...comments.map((row) => ({ ...shared(row), kind: "comment" as const, score: null })),
    ];

    return events.sort((a, b) => b.at.localeCompare(a.at)).slice(0, FEED_LIMIT);
  }

  async getDashboard(range: MetricsRange): Promise<AdminDashboard> {
    const window = rangeWindow(range);

    const [
      pulse,
      buckets,
      clubStatus,
      contribution,
      newUserActivation,
      discussion,
      works,
      busiestClubs,
      newestClubs,
      mostActivePeople,
      newestPeople,
      feed,
    ] = await Promise.all([
      this.getPulse(window),
      this.getActivityBuckets(window),
      this.getClubStatus(),
      this.getContribution(),
      this.getActivation(window.since),
      this.getDiscussion(window.since),
      this.getWorkLeaderboards(window.since),
      this.getBusiestClubs(window.since),
      this.getNewestClubs(window.since),
      this.getMostActivePeople(window.since),
      this.getNewestPeople(window.since),
      this.getFeed(),
    ]);

    return {
      generatedAt: window.now.toISOString(),
      range,
      pulse,
      activity: { unit: window.unit, buckets },
      health: { contribution, newUserActivation, discussion, clubStatus },
      works,
      clubs: { busiest: busiestClubs, newest: newestClubs },
      people: { mostActive: mostActivePeople, newest: newestPeople },
      feed,
    };
  }

  /**
   * The fixed-window numbers the daily snapshot preserves. Sign-ins and
   * unverified accounts are not reconstructible after the fact — sessions are
   * deleted as they expire — so anything not captured on the day is gone.
   */
  private async getSnapshotMetrics(): Promise<SnapshotMetrics> {
    const now = new Date();
    const since7 = daysAgo(7, now.getTime());
    const since30 = daysAgo(30, now.getTime());

    const [scalars, week, month, newUserActivation, clubStatus] = await Promise.all([
      db
        .selectNoFrom((eb) => [
          eb
            .selectFrom("user")
            .select((e) => e.fn.countAll<string>().as("c"))
            .as("users"),
          eb
            .selectFrom("user")
            .where("emailVerified", "=", true)
            .select((e) => e.fn.countAll<string>().as("c"))
            .as("verified_users"),
          eb
            .selectFrom("club")
            .select((e) => e.fn.countAll<string>().as("c"))
            .as("clubs"),
          eb
            .selectFrom("review")
            .select((e) => e.fn.countAll<string>().as("c"))
            .as("reviews"),
          eb
            .selectFrom("session")
            .where("createdAt", ">=", since7)
            .select((e) => e.fn.count<string>("userId").distinct().as("c"))
            .as("logged_in_7"),
          eb
            .selectFrom("session")
            .where("createdAt", ">=", since30)
            .select((e) => e.fn.count<string>("userId").distinct().as("c"))
            .as("logged_in_30"),
        ])
        .executeTakeFirstOrThrow(),
      this.countActivity(since7, now),
      this.countActivity(since30, now),
      this.getActivation(since30),
      this.getClubStatus(),
    ]);

    return {
      totals: {
        users: toCount(scalars.users),
        clubs: toCount(scalars.clubs),
        reviews: toCount(scalars.reviews),
      },
      engagedUsers: { last7Days: week.users, last30Days: month.users },
      loggedInUsers: {
        last7Days: toCount(scalars.logged_in_7),
        last30Days: toCount(scalars.logged_in_30),
      },
      activeClubs: { last7Days: week.clubs, last30Days: month.clubs },
      health: {
        newUserActivation,
        unverifiedUsers: toCount(scalars.users) - toCount(scalars.verified_users),
        dormantClubs: {
          numerator: clubStatus.dormant,
          denominator: clubStatus.active + clubStatus.quiet + clubStatus.dormant,
        },
      },
    };
  }

  /**
   * Records today's metrics. Keyed on `captured_on` with an upsert, so a retried
   * or manually re-triggered run overwrites the day rather than duplicating it.
   */
  async captureSnapshot(): Promise<{ capturedOn: string; metrics: SnapshotMetrics }> {
    const metrics = await this.getSnapshotMetrics();
    const capturedOn = toIsoDate(new Date());

    // The jsonb payload is serialised and cast explicitly: the generated `Json`
    // column type is an index-signature shape that a declared interface cannot
    // structurally satisfy, and casting the value with `as` to work around that
    // would defeat the point of having the type.
    const payload = sql<Json>`${JSON.stringify(metrics)}::jsonb`;

    await db
      .insertInto("metric_snapshot")
      .values({ captured_on: capturedOn, metrics: payload })
      .onConflict((oc) => oc.column("captured_on").doUpdateSet({ metrics: payload }))
      .execute();

    return { capturedOn, metrics };
  }

  /**
   * Snapshot history over the range, oldest first.
   *
   * Rows are parsed with the deliberately narrow {@link snapshotHistoryMetricsSchema}
   * and any row that fails is skipped rather than failing the request — one
   * malformed historical snapshot should not take down the dashboard.
   */
  async getSnapshots(range: MetricsRange): Promise<SnapshotHistoryPoint[]> {
    const { since } = rangeWindow(range);

    const rows = await db
      .selectFrom("metric_snapshot")
      // Formatted in the database on purpose: node-postgres returns a `date`
      // column as a Date at *local* midnight, so calling toISOString() on it
      // would report the previous day for anyone west of UTC.
      .select((eb) => [
        sql<string>`to_char(${eb.ref("captured_on")}, 'YYYY-MM-DD')`.as("captured_on"),
        "metrics",
      ])
      .where("captured_on", ">=", since)
      .orderBy("captured_on", "asc")
      .execute();

    return rows.flatMap((row) => {
      const parsed = snapshotHistoryMetricsSchema.safeParse(row.metrics);
      if (!parsed.success) {
        console.warn(`Skipping unparseable metric_snapshot for ${row.captured_on}`);
        return [];
      }
      return [{ capturedOn: row.captured_on, metrics: parsed.data }];
    });
  }
}

export default new MetricsRepository();
