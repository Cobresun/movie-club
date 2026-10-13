import { Kysely } from "kysely";

/**
 * TV metadata cache (TMDB), mirroring the `movie_details` family. Three levels
 * of detail, each keyed by the same address string its `work.external_id`
 * carries: a show is `"95396"`, a season `"95396:1"`, an episode `"95396:1:4"`.
 * That address is the whole hierarchy — there is no parent pointer on `work`,
 * and `show_external_id` here is what joins a season or episode back to its
 * show.
 *
 * The enum values these rows hang off land separately, in
 * `20260914_AddTvClubType` and `20260914_AddTvWorkType` (CockroachDB
 * enum-value restriction).
 */
export async function up(db: Kysely<unknown>) {
  await db.schema
    .createTable("tv_show_details")
    .addColumn("id", "serial", (col) => col.primaryKey())
    .addColumn("external_id", "varchar(255)", (col) => col.unique().notNull())
    .addColumn("name", "varchar(255)")
    .addColumn("overview", "text")
    .addColumn("poster_path", "varchar(255)")
    .addColumn("backdrop_path", "varchar(255)")
    .addColumn("first_air_date", "timestamptz")
    .addColumn("last_air_date", "timestamptz")
    .addColumn("status", "varchar(255)")
    .addColumn("number_of_seasons", "int8")
    .addColumn("number_of_episodes", "int8")
    .addColumn("original_language", "varchar(255)")
    .addColumn("tmdb_score", "decimal")
    .addColumn("updated_date", "timestamptz", (col) => col.notNull().defaultTo("now()"))
    .execute();

  await db.schema
    .createTable("tv_show_genres")
    .addColumn("external_id", "varchar(255)", (col) =>
      col.references("tv_show_details.external_id").onDelete("cascade").notNull(),
    )
    .addColumn("genre_name", "varchar(255)", (col) => col.notNull())
    .addUniqueConstraint("tv_show_genres_unique", ["external_id", "genre_name"])
    .execute();

  await db.schema
    .createTable("tv_show_creators")
    .addColumn("external_id", "varchar(255)", (col) =>
      col.references("tv_show_details.external_id").onDelete("cascade").notNull(),
    )
    .addColumn("creator_name", "varchar(255)", (col) => col.notNull())
    .addColumn("profile_path", "varchar(255)")
    .addUniqueConstraint("tv_show_creators_unique", ["external_id", "creator_name"])
    .execute();

  await db.schema
    .createTable("tv_show_networks")
    .addColumn("external_id", "varchar(255)", (col) =>
      col.references("tv_show_details.external_id").onDelete("cascade").notNull(),
    )
    .addColumn("network_name", "varchar(255)", (col) => col.notNull())
    .addColumn("logo_path", "varchar(255)")
    .addUniqueConstraint("tv_show_networks_unique", ["external_id", "network_name"])
    .execute();

  // Show-level cast, from TMDB's aggregate_credits: the people who recur
  // across the series rather than the guest list of any one episode.
  await db.schema
    .createTable("tv_show_cast")
    .addColumn("external_id", "varchar(255)", (col) =>
      col.references("tv_show_details.external_id").onDelete("cascade").notNull(),
    )
    .addColumn("actor_id", "int8", (col) => col.notNull())
    .addColumn("actor_name", "varchar(255)", (col) => col.notNull())
    .addColumn("character_name", "varchar(255)")
    .addColumn("cast_order", "int8", (col) => col.notNull())
    .addColumn("profile_path", "varchar(255)")
    .addColumn("popularity", "decimal")
    .addUniqueConstraint("tv_show_cast_unique", ["external_id", "actor_id"])
    .execute();

  await db.schema
    .createTable("tv_season_details")
    .addColumn("id", "serial", (col) => col.primaryKey())
    .addColumn("external_id", "varchar(255)", (col) => col.unique().notNull())
    .addColumn("show_external_id", "varchar(255)", (col) =>
      col.references("tv_show_details.external_id").onDelete("cascade").notNull(),
    )
    .addColumn("season_number", "int8", (col) => col.notNull())
    .addColumn("name", "varchar(255)")
    .addColumn("overview", "text")
    .addColumn("poster_path", "varchar(255)")
    .addColumn("air_date", "timestamptz")
    // The number of episodes TMDB lists for the season — the denominator of
    // every coverage count, and what a season-level score fills.
    .addColumn("episode_count", "int8", (col) => col.notNull().defaultTo(0))
    .addColumn("updated_date", "timestamptz", (col) => col.notNull().defaultTo("now()"))
    .execute();

  await db.schema
    .createTable("tv_episode_details")
    .addColumn("id", "serial", (col) => col.primaryKey())
    .addColumn("external_id", "varchar(255)", (col) => col.unique().notNull())
    .addColumn("show_external_id", "varchar(255)", (col) =>
      col.references("tv_show_details.external_id").onDelete("cascade").notNull(),
    )
    .addColumn("season_external_id", "varchar(255)", (col) =>
      col.references("tv_season_details.external_id").onDelete("cascade").notNull(),
    )
    .addColumn("season_number", "int8", (col) => col.notNull())
    .addColumn("episode_number", "int8", (col) => col.notNull())
    .addColumn("name", "varchar(255)")
    .addColumn("overview", "text")
    .addColumn("still_path", "varchar(255)")
    .addColumn("air_date", "timestamptz")
    .addColumn("runtime", "int8")
    .addColumn("tmdb_score", "decimal")
    .addColumn("updated_date", "timestamptz", (col) => col.notNull().defaultTo("now()"))
    .execute();

  await db.schema
    .createIndex("tv_season_details_show_idx")
    .on("tv_season_details")
    .column("show_external_id")
    .execute();

  await db.schema
    .createIndex("tv_episode_details_season_idx")
    .on("tv_episode_details")
    .column("season_external_id")
    .execute();
}

export async function down(db: Kysely<unknown>) {
  await db.schema.dropTable("tv_episode_details").execute();
  await db.schema.dropTable("tv_season_details").execute();
  await db.schema.dropTable("tv_show_cast").execute();
  await db.schema.dropTable("tv_show_networks").execute();
  await db.schema.dropTable("tv_show_creators").execute();
  await db.schema.dropTable("tv_show_genres").execute();
  await db.schema.dropTable("tv_show_details").execute();
}
