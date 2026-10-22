import { Kysely, sql } from "kysely";

/**
 * Records where each new account came from, so the admin dashboard can compare
 * acquisition channels.
 *
 * `signup_source_detail` names the referrer within the referral channel (a
 * `?ref=` tag or the referring site's host), which otherwise lumps unrelated
 * sources together. `signup_utm_source` / `signup_utm_campaign` hold the tags
 * of the landing link, so ads and posts within one channel can be told apart.
 *
 * Nullable with no backfill: nothing recorded where existing users came from,
 * and NULL ("not recorded") is the honest value for them.
 */
export async function up(db: Kysely<unknown>) {
  await db.schema
    .createType("signup_source")
    .asEnum(["invite", "share", "referral", "direct"])
    .execute();

  await db.schema
    .alterTable("user")
    .addColumn("signup_source", sql`signup_source`)
    .addColumn("signup_source_detail", "varchar(64)")
    .addColumn("signup_utm_source", "varchar(64)")
    .addColumn("signup_utm_campaign", "varchar(64)")
    .execute();
}

export async function down(db: Kysely<unknown>) {
  await db.schema
    .alterTable("user")
    .dropColumn("signup_utm_campaign")
    .dropColumn("signup_utm_source")
    .dropColumn("signup_source_detail")
    .dropColumn("signup_source")
    .execute();
  await db.schema.dropType("signup_source").execute();
}
