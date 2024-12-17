import { Kysely } from "kysely";

export async function up(db: Kysely<unknown>) {
  await db.schema
    .createTable("movie_details")
    .addColumn("id", "serial", (col) => col.primaryKey())
    .addColumn("external_id", "varchar(255)", (col) => col.unique().notNull())
    .addColumn("tmdb_score", "decimal")
    .addColumn("runtime", "int8")
    .addColumn("budget", "int8")
    .addColumn("revenue", "int8")
    .addColumn("release_date", "date")
    .addColumn("adult", "boolean")
    .addColumn("backdrop_path", "varchar(255)")
    .addColumn("homepage", "varchar(255)")
    .addColumn("imdb_id", "varchar(255)")
    .addColumn("original_language", "varchar(255)")
    .addColumn("original_title", "varchar(255)")
    .addColumn("overview", "text")
    .addColumn("popularity", "decimal")
    .addColumn("poster_path", "varchar(255)")
    .addColumn("status", "varchar(50)")
    .addColumn("tagline", "varchar(255)")
    .addColumn("title", "varchar(255)")
    .addColumn("updated_date", "timestamptz", (col) =>
      col.notNull().defaultTo("now()"),
    )
    .execute();

  await db.schema
    .createTable("movie_genres")
    .addColumn("external_id", "varchar(255)", (col) =>
      col.references("movie_details.external_id").onDelete("cascade").notNull(),
    )
    .addColumn("genre_name", "varchar(100)", (col) => col.notNull())
    .addUniqueConstraint("movie_genres_unique", ["external_id", "genre_name"])
    .execute();

  await db.schema
    .createTable("movie_production_companies")
    .addColumn("external_id", "varchar(255)", (col) =>
      col.references("movie_details.external_id").onDelete("cascade").notNull(),
    )
    .addColumn("company_name", "varchar(255)", (col) => col.notNull())
    .addColumn("logo_path", "varchar(255)")
    .addColumn("origin_country", "varchar(10)")
    .addUniqueConstraint("movie_companies_unique", [
      "external_id",
      "company_name",
    ])
    .execute();

  await db.schema
    .createTable("movie_production_countries")
    .addColumn("external_id", "varchar(255)", (col) =>
      col.references("movie_details.external_id").onDelete("cascade").notNull(),
    )
    .addColumn("country_code", "varchar(10)", (col) => col.notNull())
    .addColumn("country_name", "varchar(255)", (col) => col.notNull())
    .addUniqueConstraint("movie_countries_unique", [
      "external_id",
      "country_code",
    ])
    .execute();
}

export async function down(db: Kysely<unknown>) {
  await db.schema.dropTable("movie_production_countries").execute();
  await db.schema.dropTable("movie_production_companies").execute();
  await db.schema.dropTable("movie_genres").execute();
  await db.schema.dropTable("movie_details").execute();
}
