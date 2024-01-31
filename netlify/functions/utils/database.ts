import { CockroachDialect } from "@cubos/kysely-cockroach";
import { Kysely } from "kysely";
import { DB } from "kysely-codegen";
import { Pool } from "pg";

export const db = new Kysely<DB>({
  dialect: new CockroachDialect({
    pool: new Pool({
      connectionString: process.env.DATABASE_URL,
    }),
  }),
});
