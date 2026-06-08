import { Kysely } from "kysely";

export async function up(db: Kysely<unknown>) {
  await db.schema.alterTable("review").addColumn("emoji", "text").execute();
}

export async function down(db: Kysely<unknown>) {
  await db.schema.alterTable("review").dropColumn("emoji").execute();
}
