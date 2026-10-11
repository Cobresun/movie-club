import { Kysely, sql } from "kysely";

/**
 * Records which acquisition channel each new account arrived through, so the
 * admin dashboard can compare them.
 *
 * `signup_source_detail` names the referrer within the referral channel (a
 * `?ref=` tag or the referring site's host), which otherwise lumps unrelated
 * sources together.
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
    .execute();
}

export async function down(db: Kysely<unknown>) {
  await db.schema
    .alterTable("user")
    .dropColumn("signup_source_detail")
    .dropColumn("signup_source")
    .execute();
  await db.schema.dropType("signup_source").execute();
}
