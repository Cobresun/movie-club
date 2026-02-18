import crypto from "crypto";
import { ColumnType, Kysely, sql } from "kysely";

export type Int8 = ColumnType<
  string,
  bigint | number | string,
  bigint | number | string
>;
export type Timestamp = ColumnType<Date, Date | string, Date | string>;

/**
 * Generate a URL-friendly slug from a club name
 */
function generateSlugFromName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "") // Remove special characters
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Replace multiple hyphens with single hyphen
    .replace(/^-|-$/g, "") // Remove leading/trailing hyphens
    .substring(0, 50); // Max length 50
}

/**
 * Generate a unique slug by appending a random suffix
 */
function generateUniqueSlug(baseSlug: string): string {
  const randomSuffix = crypto.randomBytes(3).toString("hex"); // 6 chars
  const maxBaseLength = 50 - randomSuffix.length - 1; // -1 for hyphen
  const truncatedBase = baseSlug.substring(0, maxBaseLength);
  return `${truncatedBase}-${randomSuffix}`;
}

export async function up(db: Kysely<unknown>) {
  // Step 1: Add slug column (nullable initially)
  await db.schema.alterTable("club").addColumn("slug", "varchar(50)").execute();

  // Step 2: Add slug_updated_at column (nullable)
  await db.schema
    .alterTable("club")
    .addColumn("slug_updated_at", "timestamp")
    .execute();

  // Step 3: Create a typed interface for the migration
  interface MigrationClubTable {
    id: string;
    legacy_id: string | null;
    name: string;
    slug: string;
    slug_updated_at: Date | null;
  }

  const typedDb = db.withTables<{
    club: MigrationClubTable;
  }>();

  // Step 4: Fetch all existing clubs
  const clubs = await typedDb
    .selectFrom("club")
    .select(["id", "name"])
    .execute();

  // Step 5: Generate slugs for all existing clubs
  const slugMap = new Map<string, string[]>(); // slug -> [clubIds] to detect collisions
  const clubSlugs = new Map<string, string>(); // clubId -> slug

  for (const club of clubs) {
    const clubId = String(club.id);
    let baseSlug = generateSlugFromName(String(club.name));

    // Ensure minimum length of 3
    if (baseSlug.length < 3) {
      baseSlug = `club-${baseSlug}`;
    }

    let finalSlug = baseSlug;

    // Check if this slug already exists
    if (slugMap.has(finalSlug)) {
      // Generate unique slug with random suffix
      finalSlug = generateUniqueSlug(baseSlug);
      // Keep generating until we have a unique one (very unlikely to need multiple attempts)
      while (slugMap.has(finalSlug)) {
        finalSlug = generateUniqueSlug(baseSlug);
      }
    }

    slugMap.set(finalSlug, [...(slugMap.get(finalSlug) || []), clubId]);
    clubSlugs.set(clubId, finalSlug);
  }

  // Step 6: Update each club with its generated slug
  // Note: We don't set slug_updated_at here so users can change their slug immediately
  for (const [clubId, slug] of clubSlugs.entries()) {
    await typedDb
      .updateTable("club")
      .set({ slug })
      .where("id", "=", clubId)
      .execute();
  }

  // Step 7: Make slug column NOT NULL and add unique constraint
  await db.schema
    .alterTable("club")
    .alterColumn("slug", (col) => col.setNotNull())
    .execute();

  // Step 8: Add unique index on slug for performance and uniqueness
  await db.schema
    .createIndex("club_slug_unique_idx")
    .on("club")
    .column("slug")
    .unique()
    .execute();

  // Step 9: Add check constraint for slug format
  // Pattern: 3-50 chars, lowercase letters, numbers, hyphens, no leading/trailing hyphens
  await sql`
    ALTER TABLE club 
    ADD CONSTRAINT club_slug_format_check 
    CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$')
  `.execute(db);
}

export async function down(db: Kysely<unknown>) {
  // Drop constraint
  await sql`ALTER TABLE club DROP CONSTRAINT IF EXISTS club_slug_format_check`.execute(
    db,
  );

  // Drop index
  await db.schema.dropIndex("club_slug_unique_idx").execute();

  // Drop columns
  await db.schema.alterTable("club").dropColumn("slug").execute();
  await db.schema.alterTable("club").dropColumn("slug_updated_at").execute();
}
