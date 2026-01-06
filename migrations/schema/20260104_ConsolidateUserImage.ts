import { Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>) {
  // Migrate any existing image_url values to the image column
  // Prioritize user-uploaded images (image_url) over OAuth images (image)
  await sql`
    UPDATE "user"
    SET image = image_url
    WHERE image_url IS NOT NULL
  `.execute(db);

  // Drop the image_url column
  await db.schema.alterTable("user").dropColumn("image_url").execute();
}

export async function down(db: Kysely<unknown>) {
  // Re-add the image_url column
  await db.schema
    .alterTable("user")
    .addColumn("image_url", "varchar(255)")
    .execute();

  // Copy image values back to image_url
  // Note: This will copy ALL image values, including OAuth provider images
  // OAuth provider images will be lost when running down migration
  await sql`
    UPDATE "user"
    SET image_url = image
    WHERE image IS NOT NULL
  `.execute(db);
}
