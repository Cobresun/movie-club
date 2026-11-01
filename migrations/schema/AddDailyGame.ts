import { type Kysely, sql } from "kysely";

/**
 * The daily guessing game, one per work type that has one. `daily_game_puzzle`
 * holds each day's answer, drawn ahead of the day by the scheduled catalog job
 * (or by the first request, should that come first) and written here so it
 * stays put while the pool keeps growing, so later draws can avoid repeating
 * it, and so every day counts towards the puzzle number. `daily_game_catalog` holds the works a game draws on —
 * the source's best-known works, which `scheduled-daily-game-catalog.ts` keeps
 * topping up. Works clubs have added play no part. Metadata stays in each
 * type's own `*_details` tables, so neither table references them.
 */
async function up(db: Kysely<unknown>) {
  await db.schema
    .createTable("daily_game_puzzle")
    .addColumn("work_type", sql`work_type`, (col) => col.notNull())
    .addColumn("puzzle_date", "date", (col) => col.notNull())
    .addColumn("external_id", "varchar(255)", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addPrimaryKeyConstraint("daily_game_puzzle_pkey", ["work_type", "puzzle_date"])
    .execute();

  await db.schema
    .createTable("daily_game_catalog")
    .addColumn("work_type", sql`work_type`, (col) => col.notNull())
    .addColumn("external_id", "varchar(255)", (col) => col.notNull())
    .addColumn("title", "text", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addPrimaryKeyConstraint("daily_game_catalog_pkey", ["work_type", "external_id"])
    .execute();
}

async function down(db: Kysely<unknown>) {
  await db.schema.dropTable("daily_game_catalog").execute();
  await db.schema.dropTable("daily_game_puzzle").execute();
}

export default { name: "AddDailyGame", up, down };
