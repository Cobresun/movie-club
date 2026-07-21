import { Kysely, sql } from "kysely";

/**
 * Introduces book clubs:
 *  - `club_type` enum + `club.type` column (defaults existing clubs to 'movie')
 *  - `book_details` metadata cache (OpenLibrary), mirroring `movie_details`,
 *    keyed by `external_id` (the OpenLibrary Work key, e.g. "OL45804W")
 *  - `book_authors` / `book_subjects` junction tables
 *
 * The `work_type` enum gains its 'book' value separately in
 * `20260526_AddBookWorkType` (CockroachDB enum-value restriction).
 */
export async function up(db: Kysely<unknown>) {
  // Club type enum + column. Existing clubs backfill to 'movie' via the default.
  await db.schema.createType("club_type").asEnum(["movie", "book"]).execute();

  await db.schema
    .alterTable("club")
    .addColumn("type", sql`club_type`, (col) => col.notNull().defaultTo("movie"))
    .execute();

  // Book metadata cache (OpenLibrary), keyed by external_id (Work key).
  await db.schema
    .createTable("book_details")
    .addColumn("id", "serial", (col) => col.primaryKey())
    .addColumn("external_id", "varchar(255)", (col) => col.unique().notNull())
    .addColumn("title", "varchar(255)")
    .addColumn("description", "text")
    .addColumn("first_publish_year", "int8")
    .addColumn("number_of_pages", "int8")
    .addColumn("cover_url", "varchar(255)")
    .addColumn("updated_date", "timestamptz", (col) => col.notNull().defaultTo("now()"))
    .execute();

  await db.schema
    .createTable("book_authors")
    .addColumn("external_id", "varchar(255)", (col) =>
      col.references("book_details.external_id").onDelete("cascade").notNull(),
    )
    .addColumn("author_name", "varchar(255)", (col) => col.notNull())
    .addUniqueConstraint("book_authors_unique", ["external_id", "author_name"])
    .execute();

  await db.schema
    .createTable("book_subjects")
    .addColumn("external_id", "varchar(255)", (col) =>
      col.references("book_details.external_id").onDelete("cascade").notNull(),
    )
    .addColumn("subject", "varchar(255)", (col) => col.notNull())
    .addUniqueConstraint("book_subjects_unique", ["external_id", "subject"])
    .execute();
}

export async function down(db: Kysely<unknown>) {
  await db.schema.dropTable("book_subjects").execute();
  await db.schema.dropTable("book_authors").execute();
  await db.schema.dropTable("book_details").execute();
  await db.schema.alterTable("club").dropColumn("type").execute();
  await db.schema.dropType("club_type").execute();
}
