import * as crypto from "crypto";
import * as fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { hasValue } from "../../lib/checks/checks.js";
import { db } from "../../netlify/functions/utils/database";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface NetlifyUser {
  id: string;
  email: string;
  encrypted_password: string;
  confirmed_at?: string;
  confirmation_sent_at?: string;
  app_metadata: {
    provider: string;
  };
  user_metadata: {
    full_name?: string;
    avatar_url?: string;
  };
  created_at: string;
  updated_at: string;
}

interface MigrationStats {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  accountsCreated: number;
  unconfirmed: number;
  errors: number;
  errorDetails: Array<{ email: string; error: string }>;
}

/**
 * Generate a random bcrypt-compatible hash for users without passwords.
 * This is a fallback - users will need to use "forgot password" flow.
 */
function generateRandomPasswordHash(): string {
  // Generate a secure random string that looks like a bcrypt hash
  // Using a known impossible-to-guess format so users must reset
  const randomBytes = crypto.randomBytes(32).toString("hex");
  return `$2a$10$${randomBytes}IMPOSSIBLE`;
}

/**
 * Migrate a single Netlify Identity user to Better Auth
 */
async function migrateUser(
  netlifyUser: NetlifyUser,
  stats: MigrationStats,
): Promise<void> {
  const email = netlifyUser.email?.trim();

  if (!email) {
    stats.errors++;
    stats.errorDetails.push({
      email: "MISSING_EMAIL",
      error: "User has no email address",
    });
    console.error("⚠️  Skipping user with missing email");
    return;
  }

  try {
    const fullName = netlifyUser.user_metadata?.full_name ?? "";
    const emailVerified = hasValue(netlifyUser.confirmed_at);
    const createdAt = new Date(netlifyUser.created_at);
    const updatedAt = new Date(netlifyUser.updated_at);

    if (!emailVerified) {
      stats.unconfirmed++;
    }

    // Check if user already exists
    const existingUser = await db
      .selectFrom("user")
      .selectAll()
      .where("email", "=", email)
      .executeTakeFirst();

    let userId: string;

    if (existingUser) {
      // Update only if fields are null/empty
      const updates: {
        name?: string;
        emailVerified?: boolean;
        createdAt?: Date;
      } = {};

      if (!hasValue(existingUser.name)) {
        updates.name = fullName;
      }

      if (!existingUser.emailVerified && emailVerified) {
        updates.emailVerified = true;
      }

      // Preserve earlier creation date if Netlify date is older
      if (createdAt < new Date(existingUser.createdAt)) {
        updates.createdAt = createdAt;
      }

      if (Object.keys(updates).length > 0) {
        await db
          .updateTable("user")
          .set(updates)
          .where("email", "=", email)
          .execute();
        stats.updated++;
        console.log(`✅ Updated existing user: ${email}`);
      } else {
        stats.skipped++;
        console.log(`⏭️  Skipped (no changes needed): ${email}`);
      }

      userId = existingUser.id.toString();
    } else {
      // Create new user
      const result = await db
        .insertInto("user")
        .values({
          email,
          name: fullName,
          emailVerified,
          createdAt,
          updatedAt,
          image: null,
          image_id: null,
        })
        .returning("id")
        .executeTakeFirstOrThrow();

      userId = result.id.toString();
      stats.created++;
      console.log(`✨ Created new user: ${email} (${fullName})`);
    }

    // Create account record for Better Auth
    const password =
      netlifyUser.encrypted_password ?? generateRandomPasswordHash();

    if (!netlifyUser.encrypted_password) {
      console.warn(
        `⚠️  User ${email} has no password, generated random hash (will need password reset)`,
      );
    }

    // Check if account already exists to avoid duplicates
    const existingAccount = await db
      .selectFrom("account")
      .selectAll()
      .where("providerId", "=", "credential")
      .where("accountId", "=", email)
      .executeTakeFirst();

    if (!existingAccount) {
      await db
        .insertInto("account")
        .values({
          id: crypto.randomUUID(),
          accountId: email,
          providerId: "credential",
          userId: BigInt(userId),
          password,
          createdAt,
          updatedAt,
          accessToken: null,
          refreshToken: null,
          idToken: null,
          accessTokenExpiresAt: null,
          refreshTokenExpiresAt: null,
          scope: null,
        })
        .execute();

      stats.accountsCreated++;
      console.log(`🔑 Created account record for: ${email}`);
    } else {
      console.log(`🔑 Account already exists for: ${email}`);
    }
  } catch (error) {
    stats.errors++;
    stats.errorDetails.push({
      email,
      error: error instanceof Error ? error.message : String(error),
    });
    console.error(`❌ Error migrating user ${email}:`, error);
  }
}

/**
 * Main migration function
 */
async function migrateNetlifyUsers() {
  console.log("🚀 Starting Netlify Identity → Better Auth migration\n");

  // Read users.json file
  const usersPath = path.join(__dirname, "..", "users.json");

  if (!fs.existsSync(usersPath)) {
    console.error(`❌ Error: users.json not found at ${usersPath}`);
    process.exit(1);
  }

  const usersData = JSON.parse(
    fs.readFileSync(usersPath, "utf-8"),
  ) as NetlifyUser[];

  const stats: MigrationStats = {
    total: usersData.length,
    created: 0,
    updated: 0,
    skipped: 0,
    accountsCreated: 0,
    unconfirmed: 0,
    errors: 0,
    errorDetails: [],
  };

  console.log(`📊 Found ${stats.total} users in users.json\n`);

  // Process each user
  for (const user of usersData) {
    await migrateUser(user, stats);
  }

  // Print summary
  console.log("\n" + "=".repeat(50));
  console.log("📈 MIGRATION SUMMARY");
  console.log("=".repeat(50));
  console.log(`Total users in JSON:       ${stats.total}`);
  console.log(`Users created:             ${stats.created}`);
  console.log(`Users updated:             ${stats.updated}`);
  console.log(`Users skipped (no change): ${stats.skipped}`);
  console.log(`Account records created:   ${stats.accountsCreated}`);
  console.log(`Unconfirmed users:         ${stats.unconfirmed}`);
  console.log(`Errors:                    ${stats.errors}`);

  if (stats.errorDetails.length > 0) {
    console.log("\n❌ Error Details:");
    stats.errorDetails.forEach(({ email, error }) => {
      console.log(`  • ${email}: ${error}`);
    });
  }

  console.log("=".repeat(50));

  if (stats.errors > 0) {
    console.log("\n⚠️  Migration completed with errors. Please review above.");
    process.exit(1);
  } else {
    console.log("\n✅ Migration completed successfully!");
  }
}

// Run the migration
migrateNetlifyUsers()
  .then(() => {
    console.log("\n🎉 All done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Fatal error during migration:", error);
    process.exit(1);
  });
