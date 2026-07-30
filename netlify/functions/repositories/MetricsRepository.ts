import { sql } from "kysely";

import { isDefined } from "../../../lib/checks/checks.js";
import { ClubType, Json } from "../../../lib/types/generated/db.js";
import {
  ActiveUser,
  SiteHealth,
  SiteMetrics,
  SnapshotHistoryPoint,
  snapshotHistoryMetricsSchema,
  TimeSeriesPoint,
  topClubSchema,
  TRUSTED_CREATED_AT_SINCE,
} from "../../../lib/types/metrics.js";
import { db } from "../utils/database";

/** How far back the weekly growth charts reach. */
const WEEKS_OF_HISTORY = 26;

/** How many clubs the leaderboard shows. */
const TOP_CLUB_LIMIT = 10;

/** How many people the most-active leaderboard shows. */
const TOP_USER_LIMIT = 10;

/**
 * Silence after which an active club counts as dormant. Deliberately longer
 * than the 30-day activity windows: clubs meet on their own cadence, and a club
 * that skips a month is on a break, not lost.
 */
const DORMANCY_DAYS = 90;

/**
 * Fewer datable clubs than this and the time-to-first-review median is noise,
 * so the dashboard shows the sample size instead of a number.
 */
const MIN_MEDIAN_SAMPLE = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

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

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * DAY_MS);
}

/** UTC calendar date, `YYYY-MM-DD`. */
function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/**
 * Every user-attributable content event, normalised to `(user_id, club_id, ts, kind)`.
 *
 * Reviews and list items reach their club through `work_list`; comments carry
 * `club_id` directly. `work_list_item.added_by_user_id` is nullable for rows
 * added before that column existed, which is harmless for the distinct counts
 * because `count(DISTINCT …)` ignores NULLs — those rows still count toward club
 * activity, just not toward any user's engagement. Queries that group *by* user
 * exclude them explicitly.
 *
 * `kind` is cast on the first branch only: a UNION takes each column's type from
 * the leading branch, and an uncast string literal there is `unknown` rather than
 * `text`, which makes the later `FILTER (WHERE kind = 'review')` comparisons
 * ambiguous.
 */
const ACTIVITY_EVENTS = sql`
  SELECT review.user_id AS user_id, work_list.club_id AS club_id, review.created_date AS ts,
         'review'::text AS kind
  FROM review
  JOIN work_list ON work_list.id = review.list_id
  UNION ALL
  SELECT work_comment.user_id, work_comment.club_id, work_comment.created_date, 'comment'
  FROM work_comment
  UNION ALL
  SELECT work_list_item.added_by_user_id, work_list.club_id, work_list_item.time_added, 'list_add'
  FROM work_list_item
  JOIN work_list ON work_list.id = work_list_item.list_id
`;

interface ActivityRow {
  engaged_7: string;
  engaged_30: string;
  active_clubs_7: string;
  active_clubs_30: string;
}

interface WeeklyRow {
  week_start: string;
  count: string;
}

interface ActivationRow {
  signups: string;
  activated: string;
}

interface DormancyRow {
  ever_active: string;
  dormant: string;
}

interface ClubSizeRow {
  empty: string;
  solo: string;
  small: string;
  medium: string;
  large: string;
}

interface TopUserRow {
  user_id: string;
  name: string;
  image: string | null;
  total: string;
  reviews: string;
  comments: string;
  list_adds: string;
  clubs: string;
  last_active: Date;
}

/**
 * Median of an unsorted list, or null when empty. Averages the middle pair on
 * even counts.
 */
function median(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

class MetricsRepository {
  /**
   * Every scalar count in a single round trip, via correlated subqueries in one
   * `SELECT`. Ten separate `count()` queries would be ten round trips to
   * CockroachDB for a page that renders them all at once.
   */
  private async getScalars() {
    const since7 = daysAgo(7);
    const since30 = daysAgo(30);

    return await db
      .selectNoFrom((eb) => [
        eb
          .selectFrom("user")
          .select((e) => e.fn.countAll<string>().as("c"))
          .as("users"),
        eb
          .selectFrom("user")
          .where("emailVerified", "=", true)
          .select((e) => e.fn.countAll<string>().as("c"))
          .as("verifiedUsers"),
        eb
          .selectFrom("club")
          .select((e) => e.fn.countAll<string>().as("c"))
          .as("clubs"),
        eb
          .selectFrom("club")
          .where("type", "=", ClubType.movie)
          .select((e) => e.fn.countAll<string>().as("c"))
          .as("movieClubs"),
        eb
          .selectFrom("club")
          .where("type", "=", ClubType.book)
          .select((e) => e.fn.countAll<string>().as("c"))
          .as("bookClubs"),
        eb
          .selectFrom("club_member")
          .select((e) => e.fn.countAll<string>().as("c"))
          .as("memberships"),
        eb
          .selectFrom("review")
          .select((e) => e.fn.countAll<string>().as("c"))
          .as("reviews"),
        eb
          .selectFrom("work_comment")
          .select((e) => e.fn.countAll<string>().as("c"))
          .as("comments"),
        eb
          .selectFrom("work")
          .select((e) => e.fn.countAll<string>().as("c"))
          .as("works"),
        eb
          .selectFrom("work_list")
          .select((e) => e.fn.countAll<string>().as("c"))
          .as("lists"),

        eb
          .selectFrom("user")
          .where("createdAt", ">=", since7)
          .select((e) => e.fn.countAll<string>().as("c"))
          .as("newUsers7"),
        eb
          .selectFrom("user")
          .where("createdAt", ">=", since30)
          .select((e) => e.fn.countAll<string>().as("c"))
          .as("newUsers30"),
        eb
          .selectFrom("club")
          .where("created_at", ">=", since7)
          .select((e) => e.fn.countAll<string>().as("c"))
          .as("newClubs7"),
        eb
          .selectFrom("club")
          .where("created_at", ">=", since30)
          .select((e) => e.fn.countAll<string>().as("c"))
          .as("newClubs30"),

        // Distinct users who started a session in the window. Better Auth
        // deletes expired sessions, so this figure erodes as it ages — the
        // daily metric_snapshot is what preserves it.
        eb
          .selectFrom("session")
          .where("createdAt", ">=", since7)
          .select((e) => e.fn.count<string>("userId").distinct().as("c"))
          .as("loggedInUsers7"),
        eb
          .selectFrom("session")
          .where("createdAt", ">=", since30)
          .select((e) => e.fn.count<string>("userId").distinct().as("c"))
          .as("loggedInUsers30"),

        // --- Health denominators ---------------------------------------------
        // Each is a proportion's bottom half; the top halves live alongside so
        // the dashboard can show "5 of 8" rather than a bare percentage.

        // Clubs using the arbitrary-lists feature at all. System lists (the
        // reviews list) are created for every club, so they'd make adoption 100%.
        eb
          .selectFrom("work_list")
          .where("system_type", "is", null)
          .select((e) => e.fn.count<string>("club_id").distinct().as("c"))
          .as("clubsWithCustomLists"),

        // Works that have been reviewed — the denominator for comment rate.
        // A work nobody reviewed was never really "discussed" to begin with.
        eb
          .selectFrom("review")
          .select((e) => e.fn.count<string>("work_id").distinct().as("c"))
          .as("reviewedWorks"),

        // Reviewed works that also drew at least one comment.
        eb
          .selectFrom("review")
          .where((e) =>
            e.exists(
              e
                .selectFrom("work_comment")
                .whereRef("work_comment.work_id", "=", "review.work_id")
                .select(sql`1`.as("one")),
            ),
          )
          .select((e) => e.fn.count<string>("work_id").distinct().as("c"))
          .as("commentedWorks"),
      ])
      .executeTakeFirstOrThrow();
  }

  /**
   * Engaged users and active clubs, both windows, from one pass over the
   * unioned activity events. `FILTER` lets a single scan serve both windows.
   */
  private async getActivity(): Promise<ActivityRow> {
    const since7 = daysAgo(7);
    const since30 = daysAgo(30);

    const result = await sql<ActivityRow>`
      WITH activity AS (${ACTIVITY_EVENTS})
      SELECT
        count(DISTINCT user_id) FILTER (WHERE ts >= ${since7}) AS engaged_7,
        count(DISTINCT user_id) FILTER (WHERE ts >= ${since30}) AS engaged_30,
        count(DISTINCT club_id) FILTER (WHERE ts >= ${since7}) AS active_clubs_7,
        count(DISTINCT club_id) FILTER (WHERE ts >= ${since30}) AS active_clubs_30
      FROM activity
    `.execute(db);

    const row = result.rows[0];
    return isDefined(row)
      ? row
      : { engaged_7: "0", engaged_30: "0", active_clubs_7: "0", active_clubs_30: "0" };
  }

  /**
   * Do signups become users? Counts people who joined in the last 30 days and
   * how many of them have since done anything at all.
   *
   * `EXISTS` rather than a join or an `IN`: the question is only whether a user
   * appears in the activity set, and stopping at the first match avoids
   * aggregating every event belonging to a prolific new member.
   */
  private async getActivation(): Promise<ActivationRow> {
    const since30 = daysAgo(30);

    const result = await sql<ActivationRow>`
      WITH activity AS (${ACTIVITY_EVENTS}),
      recent_users AS (SELECT id FROM "user" WHERE "createdAt" >= ${since30})
      SELECT
        (SELECT count(*) FROM recent_users) AS signups,
        (SELECT count(*) FROM recent_users
         WHERE EXISTS (SELECT 1 FROM activity WHERE activity.user_id = recent_users.id))
          AS activated
    `.execute(db);

    return result.rows[0] ?? { signups: "0", activated: "0" };
  }

  /**
   * Clubs that went quiet. A club counts as dormant once it has a history of
   * activity but nothing within {@link DORMANCY_DAYS}.
   *
   * Deliberately measured over all activity rather than reviews alone: a club
   * still adding to its watchlist is alive even if nobody has scored anything.
   * Clubs that never did anything are excluded from both halves — they never
   * became active, so they cannot have lapsed.
   */
  private async getDormancy(): Promise<DormancyRow> {
    const cutoff = daysAgo(DORMANCY_DAYS);

    const result = await sql<DormancyRow>`
      WITH activity AS (${ACTIVITY_EVENTS}),
      club_last_seen AS (
        SELECT club_id, max(ts) AS last_ts
        FROM activity
        WHERE club_id IS NOT NULL
        GROUP BY club_id
      )
      SELECT
        count(*) AS ever_active,
        count(*) FILTER (WHERE last_ts < ${cutoff}) AS dormant
      FROM club_last_seen
    `.execute(db);

    return result.rows[0] ?? { ever_active: "0", dormant: "0" };
  }

  /**
   * Days from club creation to first review, one row per club.
   *
   * Restricted to clubs created after {@link TRUSTED_CREATED_AT_SINCE}: earlier
   * clubs had `created_at` backfilled *from* their first review, so they would
   * all score ~0 days and produce a median describing the migration rather than
   * how quickly new clubs get going.
   *
   * The median is taken in TypeScript rather than with `percentile_cont`, whose
   * `WITHIN GROUP` ordered-set syntax CockroachDB does not implement. The row
   * count is bounded by the number of clubs, so there is nothing to stream.
   */
  private async getDaysToFirstReview(): Promise<number[]> {
    const result = await sql<{ days: string }>`
      SELECT extract(epoch FROM (min(review.created_date) - club.created_at)) / 86400 AS days
      FROM club
      JOIN work_list ON work_list.club_id = club.id
      JOIN review ON review.list_id = work_list.id
      WHERE club.created_at >= ${TRUSTED_CREATED_AT_SINCE}
      GROUP BY club.id, club.created_at
    `.execute(db);

    // A review predating its club's created_at would give a negative interval.
    // Clamp rather than drop: it is a data artefact, not a club that took
    // negative time to get started.
    return result.rows.map((row) => Math.max(0, Number(row.days))).filter(Number.isFinite);
  }

  /**
   * How many clubs are solo, small, or genuinely group-sized.
   *
   * `LEFT JOIN` so clubs with no members at all land in the `empty` bucket —
   * an inner join would drop them, and a club nobody joined is precisely the
   * kind of thing this histogram exists to expose.
   */
  private async getClubSizes(): Promise<ClubSizeRow> {
    const result = await sql<ClubSizeRow>`
      WITH sizes AS (
        SELECT club.id, count(club_member.user_id) AS members
        FROM club
        LEFT JOIN club_member ON club_member.club_id = club.id
        GROUP BY club.id
      )
      SELECT
        count(*) FILTER (WHERE members = 0) AS empty,
        count(*) FILTER (WHERE members = 1) AS solo,
        count(*) FILTER (WHERE members BETWEEN 2 AND 3) AS small,
        count(*) FILTER (WHERE members BETWEEN 4 AND 6) AS medium,
        count(*) FILTER (WHERE members >= 7) AS large
      FROM sizes
    `.execute(db);

    return result.rows[0] ?? { empty: "0", solo: "0", small: "0", medium: "0", large: "0" };
  }

  /**
   * Which auth providers people actually sign up with.
   *
   * Counted per provider, not per user: linking Google to an existing password
   * account creates a second `account` row, so a user can appear in two buckets
   * and the buckets do not sum to the user total. That is the useful reading
   * anyway — the question is which providers need to keep working.
   */
  private async getSignupMethods() {
    const rows = await db
      .selectFrom("account")
      .select((eb) => ["providerId", eb.fn.count<string>("userId").distinct().as("users")])
      .groupBy("providerId")
      .orderBy("users", "desc")
      .execute();

    return rows.map((row) => ({ provider: row.providerId, users: toCount(row.users) }));
  }

  /**
   * The busiest people over the last 30 days, broken down by what they did.
   *
   * The breakdown matters more than the total: someone with forty comments and
   * no reviews is a different kind of user from the reverse, and a single
   * "events" column hides that entirely.
   */
  private async getTopUsers(): Promise<ActiveUser[]> {
    const since30 = daysAgo(30);

    const result = await sql<TopUserRow>`
      WITH activity AS (${ACTIVITY_EVENTS})
      SELECT
        activity.user_id AS user_id,
        "user".name AS name,
        "user".image AS image,
        count(*) AS total,
        count(*) FILTER (WHERE kind = 'review') AS reviews,
        count(*) FILTER (WHERE kind = 'comment') AS comments,
        count(*) FILTER (WHERE kind = 'list_add') AS list_adds,
        count(DISTINCT activity.club_id) AS clubs,
        max(activity.ts) AS last_active
      FROM activity
      JOIN "user" ON "user".id = activity.user_id
      WHERE activity.ts >= ${since30}
      GROUP BY activity.user_id, "user".name, "user".image
      ORDER BY total DESC
      LIMIT ${TOP_USER_LIMIT}
    `.execute(db);

    return result.rows.map((row) => ({
      userId: String(row.user_id),
      name: row.name,
      image: row.image,
      reviews: toCount(row.reviews),
      comments: toCount(row.comments),
      listAdds: toCount(row.list_adds),
      total: toCount(row.total),
      clubs: toCount(row.clubs),
      lastActive: new Date(row.last_active).toISOString(),
    }));
  }

  private toSeries(rows: WeeklyRow[]): TimeSeriesPoint[] {
    return rows.map((row) => ({ weekStart: row.week_start, count: toCount(row.count) }));
  }

  /**
   * Weekly buckets for the three growth charts. Raw SQL here because
   * `date_trunc` grouping gains nothing from Kysely's type system and reads far
   * worse through it. `to_char` formats in the database so the bucket key never
   * passes through a JS timezone conversion on the way out.
   */
  private async getWeeklySeries() {
    const since = daysAgo(WEEKS_OF_HISTORY * 7);

    const [users, clubs, reviews] = await Promise.all([
      sql<WeeklyRow>`
        SELECT to_char(date_trunc('week', "createdAt"), 'YYYY-MM-DD') AS week_start,
               count(*) AS count
        FROM "user"
        WHERE "createdAt" >= ${since}
        GROUP BY 1
        ORDER BY 1
      `.execute(db),
      sql<WeeklyRow>`
        SELECT to_char(date_trunc('week', created_at), 'YYYY-MM-DD') AS week_start,
               count(*) AS count
        FROM club
        WHERE created_at >= ${since}
        GROUP BY 1
        ORDER BY 1
      `.execute(db),
      sql<WeeklyRow>`
        SELECT to_char(date_trunc('week', created_date), 'YYYY-MM-DD') AS week_start,
               count(*) AS count
        FROM review
        WHERE created_date >= ${since}
        GROUP BY 1
        ORDER BY 1
      `.execute(db),
    ]);

    return {
      users: this.toSeries(users.rows),
      clubs: this.toSeries(clubs.rows),
      reviews: this.toSeries(reviews.rows),
    };
  }

  /**
   * Busiest clubs by review count. Member and review counts are correlated
   * subqueries rather than joins: joining both tables would multiply rows and
   * inflate each count by the other's cardinality.
   */
  private async getTopClubs() {
    const rows = await db
      .selectFrom("club")
      .select((eb) => [
        "club.id",
        "club.name",
        "club.slug",
        "club.type",
        "club.created_at",
        eb
          .selectFrom("club_member")
          .whereRef("club_member.club_id", "=", "club.id")
          .select((e) => e.fn.countAll<string>().as("c"))
          .as("member_count"),
        eb
          .selectFrom("review")
          .innerJoin("work_list", "work_list.id", "review.list_id")
          .whereRef("work_list.club_id", "=", "club.id")
          .select((e) => e.fn.countAll<string>().as("c"))
          .as("review_count"),
      ])
      .orderBy(sql`review_count`, "desc")
      .limit(TOP_CLUB_LIMIT)
      .execute();

    const memberNames = await this.getMemberNames(rows.map((row) => row.id));

    // Parsed rather than cast: `club.type` arrives as a plain string and
    // topClubSchema's nativeEnum check is what makes it a ClubType.
    return rows.map((row) =>
      topClubSchema.parse({
        clubId: row.id,
        name: row.name,
        slug: row.slug,
        type: row.type,
        memberCount: toCount(row.member_count),
        memberNames: memberNames.get(String(row.id)) ?? [],
        reviewCount: toCount(row.review_count),
        createdAt: isDefined(row.created_at) ? toIsoDate(row.created_at) : null,
      }),
    );
  }

  /**
   * Member names for the leaderboard clubs, grouped by club.
   *
   * A follow-up query keyed on the ids the previous one returned, rather than a
   * join or an `array_agg` correlated subquery: the leaderboard is ten clubs, so
   * this is one small indexed lookup, and joining members into the club query
   * would multiply its rows and break the review count it already computes.
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

  async getMetrics(): Promise<SiteMetrics> {
    const [
      scalars,
      activity,
      weekly,
      topClubs,
      topUsers,
      activation,
      dormancy,
      daysToFirstReview,
      clubSizes,
      signupMethods,
    ] = await Promise.all([
      this.getScalars(),
      this.getActivity(),
      this.getWeeklySeries(),
      this.getTopClubs(),
      this.getTopUsers(),
      this.getActivation(),
      this.getDormancy(),
      this.getDaysToFirstReview(),
      this.getClubSizes(),
      this.getSignupMethods(),
    ]);

    const totalUsers = toCount(scalars.users);
    const totalClubs = toCount(scalars.clubs);

    const health: SiteHealth = {
      newUserActivation: {
        numerator: toCount(activation.activated),
        denominator: toCount(activation.signups),
      },
      unverifiedUsers: totalUsers - toCount(scalars.verifiedUsers),
      dormantClubs: {
        numerator: toCount(dormancy.dormant),
        denominator: toCount(dormancy.ever_active),
      },
      // Withheld rather than shown as a shaky number: a median over one or two
      // clubs says nothing, and the sample size travels alongside so the UI can
      // explain the blank instead of rendering an empty stat.
      medianDaysToFirstReview:
        daysToFirstReview.length >= MIN_MEDIAN_SAMPLE ? median(daysToFirstReview) : null,
      daysToFirstReviewSample: daysToFirstReview.length,
      customListAdoption: {
        numerator: toCount(scalars.clubsWithCustomLists),
        denominator: totalClubs,
      },
      commentedWorks: {
        numerator: toCount(scalars.commentedWorks),
        denominator: toCount(scalars.reviewedWorks),
      },
      clubSizes: [
        { label: "No members", clubs: toCount(clubSizes.empty) },
        { label: "1", clubs: toCount(clubSizes.solo) },
        { label: "2–3", clubs: toCount(clubSizes.small) },
        { label: "4–6", clubs: toCount(clubSizes.medium) },
        { label: "7+", clubs: toCount(clubSizes.large) },
      ],
      signupMethods,
    };

    return {
      generatedAt: new Date().toISOString(),
      totals: {
        users: totalUsers,
        verifiedUsers: toCount(scalars.verifiedUsers),
        clubs: totalClubs,
        movieClubs: toCount(scalars.movieClubs),
        bookClubs: toCount(scalars.bookClubs),
        memberships: toCount(scalars.memberships),
        reviews: toCount(scalars.reviews),
        comments: toCount(scalars.comments),
        works: toCount(scalars.works),
        lists: toCount(scalars.lists),
      },
      newUsers: {
        last7Days: toCount(scalars.newUsers7),
        last30Days: toCount(scalars.newUsers30),
      },
      newClubs: {
        last7Days: toCount(scalars.newClubs7),
        last30Days: toCount(scalars.newClubs30),
      },
      engagedUsers: {
        last7Days: toCount(activity.engaged_7),
        last30Days: toCount(activity.engaged_30),
      },
      loggedInUsers: {
        last7Days: toCount(scalars.loggedInUsers7),
        last30Days: toCount(scalars.loggedInUsers30),
      },
      activeClubs: {
        last7Days: toCount(activity.active_clubs_7),
        last30Days: toCount(activity.active_clubs_30),
      },
      weekly,
      health,
      topClubs,
      topUsers,
    };
  }

  /**
   * Records today's metrics. Keyed on `captured_on` with an upsert, so a retried
   * or manually re-triggered run overwrites the day rather than duplicating it.
   */
  async captureSnapshot(): Promise<{ capturedOn: string; metrics: SiteMetrics }> {
    const metrics = await this.getMetrics();
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
   * Snapshot history, oldest first.
   *
   * Rows are parsed with the deliberately narrow {@link snapshotHistoryMetricsSchema}
   * and any row that fails is skipped rather than failing the request — one
   * malformed historical snapshot should not take down the dashboard.
   */
  async getSnapshots(days: number): Promise<SnapshotHistoryPoint[]> {
    const rows = await db
      .selectFrom("metric_snapshot")
      // Formatted in the database on purpose: node-postgres returns a `date`
      // column as a Date at *local* midnight, so calling toISOString() on it
      // would report the previous day for anyone west of UTC.
      .select([sql<string>`to_char(captured_on, 'YYYY-MM-DD')`.as("captured_on"), "metrics"])
      .where("captured_on", ">=", daysAgo(days))
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
