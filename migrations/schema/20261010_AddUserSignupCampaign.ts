import { Kysely } from "kysely";

/**
 * Records the `utm_source` and `utm_campaign` a new account's landing link was
 * tagged with, so ads and posts that share the `referral` channel can be
 * compared. Nullable with no backfill, like `signup_source`.
 */
export async function up(db: Kysely<unknown>) {
  await db.schema
    .alterTable("user")
    .addColumn("signup_utm_source", "varchar(64)")
    .addColumn("signup_utm_campaign", "varchar(64)")
    .execute();
}

export async function down(db: Kysely<unknown>) {
  await db.schema
    .alterTable("user")
    .dropColumn("signup_utm_source")
    .dropColumn("signup_utm_campaign")
    .execute();
}
