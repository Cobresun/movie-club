import { CockroachDialect } from "@cubos/kysely-cockroach";
import { Kysely } from "kysely";
import { Pool } from "pg";

import { DB } from "../../../lib/types/generated/db";

export const db = new Kysely<DB>({
  dialect: new CockroachDialect({
    pool: new Pool({
      connectionString: process.env.DATABASE_URL,
    }),
  }),
});
