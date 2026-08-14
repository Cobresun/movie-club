import { existsSync } from "fs";
import path from "path";
import { inject } from "vitest";

/**
 * Points the backend at the throwaway CockroachDB started by `globalSetup.ts`.
 *
 * `utils/database.ts` builds its pool from `DATABASE_URL` at import time, and
 * the container's port is only known once it is running — so unlike the static
 * service credentials (which live in `vite.config.ts`'s `test.env`) this one
 * cannot be declared up front. Importing this module first, before anything
 * that reaches `utils/database.ts`, is what makes the ordering work; see
 * `setup/integration.ts`.
 */
const databaseUrl = inject("databaseUrl");

// `getDbUrl()` prefers ./database-config.json over the environment, so a
// developer with a leftover one from `netlify dev` would silently run the
// integration suite — resets and all — against whatever database that file
// names. Refuse to start rather than truncate someone's dev data.
const configPath = path.resolve("./database-config.json");
if (existsSync(configPath)) {
  throw new Error(
    `${configPath} exists and takes precedence over DATABASE_URL, so the integration suite ` +
      `would run against that database and delete its contents. Move or remove it first.`,
  );
}

process.env.DATABASE_URL = databaseUrl;

// `DatabaseCleanupRepository` builds its own admin pool against `defaultdb`
// from this, defaulting `sslmode` to `verify-full` when the URL does not say
// otherwise — which an insecure test container refuses. Say otherwise.
const rootUrl = new URL(databaseUrl);
rootUrl.searchParams.set("sslmode", "disable");
process.env.DATABASE_URL_ROOT = rootUrl.toString();

export { databaseUrl };
