import { type Kysely, sql } from "kysely";

/**
 * One row per player per puzzle day on which they followed the finished
 * game's call to start a club, so the admin dashboard can show how many
 * signed-out players get from a finished puzzle to the sign-up page. Keyed
 * like `daily_game_result`, so repeat clicks on a day count once.
 */
async function up(db: Kysely<unknown>) {
  await db.schema
    .createTable("daily_game_cta_click")
    .addColumn("work_type", sql`work_type`, (col) => col.notNull())
    .addColumn("puzzle_date", "date", (col) => col.notNull())
    .addColumn("player_id", "uuid", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addPrimaryKeyConstraint("daily_game_cta_click_pkey", ["work_type", "puzzle_date", "player_id"])
    .execute();
}

async function down(db: Kysely<unknown>) {
  await db.schema.dropTable("daily_game_cta_click").execute();
}

export default { name: "AddDailyGameCtaClick", up, down };
