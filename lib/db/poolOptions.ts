/**
 * Connection options for every `pg.Pool` opened during a Netlify build.
 *
 * node-postgres defaults `connectionTimeoutMillis` to `0` — wait forever — and
 * applies no query deadline at all. In an interactive shell an unbounded wait is
 * a hang you Ctrl-C; inside a metered build it is a socket that bills until
 * Netlify's build timeout fires. Two deploy previews on 2026-07-24 stalled that
 * way for 18 and 27 minutes, burning ~45 minutes — 13% of that month's 300-min
 * budget — and produced nothing.
 *
 * Both values below are enforced client-side by `pg`. We deliberately do not set
 * the server-side `statement_timeout`: it travels in the connection startup
 * packet, so a CockroachDB version that rejected it would break every build
 * rather than just the wedged one.
 *
 * The plugin at `netlify/plugins/preview-database/index.js` runs as plain Node
 * (not through tsx) and so cannot import this module; it repeats these values
 * inline and points back here.
 */

/** Give up on an unreachable CockroachDB rather than blocking the build. */
export const BUILD_CONNECTION_TIMEOUT_MS = 30_000;

/**
 * Deadline for ordinary build-time queries: schema lookups, `DROP DATABASE`,
 * `COMMENT ON`. All are fast; a minute is pure headroom.
 */
export const BUILD_QUERY_TIMEOUT_MS = 60_000;

/**
 * Deadline for `SHOW BACKUPS` / `RESTORE DATABASE`, which run as a single
 * blocking query.
 *
 * A restore legitimately takes ~1-2 minutes on our dataset (migration-carrying
 * previews measure 124-190s end to end, against a ~46s median elsewhere), so
 * this ceiling is deliberately generous. It exists to stop a wedged restore from
 * running until the build times out, not to bound normal operation.
 */
export const RESTORE_QUERY_TIMEOUT_MS = 480_000;

/**
 * Deadline for a single migration statement.
 *
 * Migrations here are not pure DDL — `20260315_AddPersonProfilePaths.ts` backfills
 * from TMDB — so this has to clear a slow-but-healthy migration by a wide margin.
 * The outer `timeout` wrapping the build command (see `netlify.toml`) is the
 * tighter guard; this one exists so the failure surfaces as a migration error
 * with a stack trace rather than an opaque killed build.
 */
export const MIGRATION_QUERY_TIMEOUT_MS = 480_000;

/** Pool options for build-time connections that only issue fast queries. */
export const buildPoolOptions = {
  connectionTimeoutMillis: BUILD_CONNECTION_TIMEOUT_MS,
  query_timeout: BUILD_QUERY_TIMEOUT_MS,
} as const;
