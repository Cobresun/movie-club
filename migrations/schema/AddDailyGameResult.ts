import { type Kysely, sql } from "kysely";

/**
 * One row per finished daily-game puzzle per player, for the admin dashboard.
 * Players need no account, so `player_id` is a random id their browser keeps;
 * a signed-in player's account is kept too, so their days count once across
 * devices. A player's first finish of a day stands, so a replayed request
 * changes nothing.
 */
async function up(db: Kysely<unknown>) {
  await db.schema
    .createTable("daily_game_result")
    .addColumn("work_type", sql`work_type`, (col) => col.notNull())
    .addColumn("puzzle_date", "date", (col) => col.notNull())
    .addColumn("player_id", "uuid", (col) => col.notNull())
    .addColumn("user_id", "int8", (col) => col.references("user.id").onDelete("set null"))
    .addColumn("solved", "boolean", (col) => col.notNull())
    .addColumn("guesses", "integer", (col) => col.notNull())
    .addColumn("hints", "integer", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addPrimaryKeyConstraint("daily_game_result_pkey", ["work_type", "puzzle_date", "player_id"])
    .execute();

  // A NULL user_id never conflicts, so this only binds signed-in players.
  await db.schema
    .createIndex("daily_game_result_work_type_puzzle_date_user_id_key")
    .on("daily_game_result")
    .columns(["work_type", "puzzle_date", "user_id"])
    .unique()
    .execute();
}

async function down(db: Kysely<unknown>) {
  await db.schema.dropTable("daily_game_result").execute();
}

export default { name: "AddDailyGameResult", up, down };
