import { sql } from "kysely";

import { isDefined } from "../../../lib/checks/checks.js";
import { ClubType, Json } from "../../../lib/types/generated/db.js";
import {
  SiteMetrics,
  SnapshotHistoryPoint,
  snapshotHistoryMetricsSchema,
  TimeSeriesPoint,
  topClubSchema,
} from "../../../lib/types/metrics.js";
import { db } from "../utils/database";

/** How far back the weekly growth charts reach. */
const WEEKS_OF_HISTORY = 26;

/** How many clubs the leaderboard shows. */
const TOP_CLUB_LIMIT = 10;

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
 * Every user-attributable content event, normalised to `(user_id, club_id, ts)`.
 *
 * Reviews and list items reach their club through `work_list`; comments carry
 * `club_id` directly. `work_list_item.added_by_user_id` is nullable for rows
 * added before that column existed, which is harmless here because
 * `count(DISTINCT …)` ignores NULLs — those rows still count toward club
 * activity, just not toward any user's engagement.
 */
const ACTIVITY_EVENTS = sql`
  SELECT review.user_id AS user_id, work_list.club_id AS club_id, review.created_date AS ts
  FROM review
  JOIN work_list ON work_list.id = review.list_id
  UNION ALL
  SELECT work_comment.user_id, work_comment.club_id, work_comment.created_date
  FROM work_comment
  UNION ALL
  SELECT work_list_item.added_by_user_id, work_list.club_id, work_list_item.time_added
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

    // Parsed rather than cast: `club.type` arrives as a plain string and
    // topClubSchema's nativeEnum check is what makes it a ClubType.
    return rows.map((row) =>
      topClubSchema.parse({
        clubId: row.id,
        name: row.name,
        slug: row.slug,
        type: row.type,
        memberCount: toCount(row.member_count),
        reviewCount: toCount(row.review_count),
        createdAt: isDefined(row.created_at) ? toIsoDate(row.created_at) : null,
      }),
    );
  }

  async getMetrics(): Promise<SiteMetrics> {
    const [scalars, activity, weekly, topClubs] = await Promise.all([
      this.getScalars(),
      this.getActivity(),
      this.getWeeklySeries(),
      this.getTopClubs(),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      totals: {
        users: toCount(scalars.users),
        verifiedUsers: toCount(scalars.verifiedUsers),
        clubs: toCount(scalars.clubs),
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
      topClubs,
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
