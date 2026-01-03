import * as fs from "fs";
import { sql } from "kysely";
import path from "path";
import { fileURLToPath } from "url";

import { db } from "../../netlify/functions/utils/database";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface AwardYear {
  year: number;
  step: number;
  awards: unknown[];
}

interface ClubAwardsBackup {
  clubAwards: AwardYear[];
}

async function migrateAwardsData() {
  console.log("🚀 Starting Awards Data Migration\n");

  // Read clubAwardsBackup.json file
  const backupPath = path.join(__dirname, "..", "clubAwardsBackup.json");

  if (!fs.existsSync(backupPath)) {
    console.error(`❌ Error: clubAwardsBackup.json not found at ${backupPath}`);
    process.exit(1);
  }

  const backupData = JSON.parse(
    fs.readFileSync(backupPath, "utf-8"),
  ) as ClubAwardsBackup;

  console.log(
    `📊 Found ${backupData.clubAwards.length} award years to migrate\n`,
  );

  // Look up Cobresun club by name
  const club = await db
    .selectFrom("club")
    .select("id")
    .where("name", "=", "Cobresun")
    .executeTakeFirst();

  if (!club) {
    console.error(
      "❌ Error: Cobresun club not found. Please ensure the club exists before running this migration.",
    );
    process.exit(1);
  }

  const clubId = club.id;
  console.log(`✅ Found Cobresun club with id: ${clubId}\n`);

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const awardYear of backupData.clubAwards) {
    const { year, ...data } = awardYear;

    try {
      // Check if this year already exists (using raw SQL since table may not be in types yet)
      const existing = await sql<{ year: number }>`
        SELECT year FROM awards_temp 
        WHERE club_id = ${clubId} AND year = ${year}
      `.execute(db);

      if (existing.rows.length > 0) {
        console.log(`⏭️  Skipped year ${year} (already exists)`);
        skipped++;
        continue;
      }

      // Insert using raw SQL since table may not be in types yet
      await sql`
        INSERT INTO awards_temp (club_id, year, data)
        VALUES (${clubId}, ${year}, ${JSON.stringify(data)}::jsonb)
      `.execute(db);

      console.log(
        `✨ Migrated year ${year} (${data.awards.length} categories)`,
      );
      migrated++;
    } catch (error) {
      console.error(`❌ Error migrating year ${year}:`, error);
      errors++;
    }
  }

  // Print summary
  console.log("\n" + "=".repeat(50));
  console.log("📈 MIGRATION SUMMARY");
  console.log("=".repeat(50));
  console.log(`Total years in backup:     ${backupData.clubAwards.length}`);
  console.log(`Years migrated:            ${migrated}`);
  console.log(`Years skipped (existing):  ${skipped}`);
  console.log(`Errors:                    ${errors}`);
  console.log("=".repeat(50));

  if (errors > 0) {
    console.log("\n⚠️  Migration completed with errors. Please review above.");
    process.exit(1);
  } else {
    console.log("\n✅ Migration completed successfully!");
  }
}

// Run the migration
migrateAwardsData()
  .then(() => {
    console.log("\n🎉 All done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Fatal error during migration:", error);
    process.exit(1);
  });
