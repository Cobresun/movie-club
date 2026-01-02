import { Kysely } from "kysely";

export async function up(db: Kysely<unknown>) {
  // Rename username column to name
  await db.schema.alterTable("user").renameColumn("username", "name").execute();

  // Drop unique constraint on name
  await db.schema.dropIndex("user_username_key").cascade().execute();

  // Add new columns to user table
  await db.schema
    .alterTable("user")
    .addColumn("emailVerified", "boolean", (col) =>
      col.notNull().defaultTo(false),
    )
    .addColumn("image", "text")
    .addColumn("createdAt", "timestamptz", (col) =>
      col.notNull().defaultTo("now()"),
    )
    .addColumn("updatedAt", "timestamptz", (col) =>
      col.notNull().defaultTo("now()"),
    )
    .execute();

  // Create session table
  await db.schema
    .createTable("session")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("expiresAt", "timestamptz", (col) => col.notNull())
    .addColumn("token", "text", (col) => col.notNull().unique())
    .addColumn("createdAt", "timestamptz", (col) =>
      col.notNull().defaultTo("now()"),
    )
    .addColumn("updatedAt", "timestamptz", (col) => col.notNull())
    .addColumn("ipAddress", "text")
    .addColumn("userAgent", "text")
    .addColumn("userId", "int8", (col) => col.notNull())
    .addForeignKeyConstraint(
      "fk_session_user_id",
      ["userId"],
      "user",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .execute();

  // Create session index
  await db.schema
    .createIndex("session_userId_idx")
    .on("session")
    .column("userId")
    .execute();

  // Create account table
  await db.schema
    .createTable("account")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("accountId", "text", (col) => col.notNull())
    .addColumn("providerId", "text", (col) => col.notNull())
    .addColumn("userId", "int8", (col) => col.notNull())
    .addColumn("accessToken", "text")
    .addColumn("refreshToken", "text")
    .addColumn("idToken", "text")
    .addColumn("accessTokenExpiresAt", "timestamptz")
    .addColumn("refreshTokenExpiresAt", "timestamptz")
    .addColumn("scope", "text")
    .addColumn("password", "text")
    .addColumn("createdAt", "timestamptz", (col) =>
      col.notNull().defaultTo("now()"),
    )
    .addColumn("updatedAt", "timestamptz", (col) => col.notNull())
    .addForeignKeyConstraint(
      "fk_account_user_id",
      ["userId"],
      "user",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .execute();

  // Create account index
  await db.schema
    .createIndex("account_userId_idx")
    .on("account")
    .column("userId")
    .execute();

  // Create verification table
  await db.schema
    .createTable("verification")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("identifier", "text", (col) => col.notNull())
    .addColumn("value", "text", (col) => col.notNull())
    .addColumn("expiresAt", "timestamptz", (col) => col.notNull())
    .addColumn("createdAt", "timestamptz", (col) =>
      col.notNull().defaultTo("now()"),
    )
    .addColumn("updatedAt", "timestamptz", (col) =>
      col.notNull().defaultTo("now()"),
    )
    .execute();

  // Create verification index
  await db.schema
    .createIndex("verification_identifier_idx")
    .on("verification")
    .column("identifier")
    .execute();
}

export async function down(db: Kysely<unknown>) {
  // Drop tables in reverse order
  await db.schema.dropTable("verification").execute();
  await db.schema.dropTable("account").execute();
  await db.schema.dropTable("session").execute();

  // Remove columns from user table
  await db.schema
    .alterTable("user")
    .dropColumn("updatedAt")
    .dropColumn("createdAt")
    .dropColumn("image")
    .dropColumn("emailVerified")
    .execute();

  // Rename name column back to username
  await db.schema.alterTable("user").renameColumn("name", "username").execute();

  // Recreate unique constraint on username
  await db.schema
    .alterTable("user")
    .addUniqueConstraint("user_username_key", ["username"])
    .execute();
}
