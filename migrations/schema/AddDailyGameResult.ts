import { type Kysely, sql } from "kysely";

/**
 * One row per finished daily-game puzzle per player, for the admin dashboard.
 * Players need no account, so `player_id` is a random id their browser keeps;
 * a player's first finish of a day stands, so a replayed request changes nothing.
 */
async function up(db: Kysely<unknown>) {
  await db.schema
    .createTable("daily_game_result")
    .addColumn("work_type", sql`work_type`, (col) => col.notNull())
    .addColumn("puzzle_date", "date", (col) => col.notNull())
    .addColumn("player_id", "uuid", (col) => col.notNull())
    .addColumn("solved", "boolean", (col) => col.notNull())
    .addColumn("guesses", "integer", (col) => col.notNull())
    .addColumn("hints", "integer", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addPrimaryKeyConstraint("daily_game_result_pkey", ["work_type", "puzzle_date", "player_id"])
    .execute();

  await db.schema
    .createIndex("daily_game_result_work_type_created_at_idx")
    .on("daily_game_result")
    .columns(["work_type", "created_at"])
    .execute();
}

async function down(db: Kysely<unknown>) {
  await db.schema.dropTable("daily_game_result").execute();
}

export default { name: "AddDailyGameResult", up, down };
