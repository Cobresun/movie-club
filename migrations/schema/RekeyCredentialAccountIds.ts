import { type Kysely } from "kysely";

/**
 * The one-off Netlify Identity import (`20251216_MigrateNetlifyUsers`) wrote
 * each `"credential"` row in `account` with `accountId = user.email`. Better
 * Auth's own sign-up and password-reset paths set `accountId = user.id`, and
 * starting in 1.7 `signInEmail`, `findCredentialAccount`, and `updatePassword`
 * require `account."accountId" = user.id` — returning 401 for every imported
 * account until `accountId` carries the user ID.
 */

type MigrationTables = {
  account: {
    accountId: string;
    providerId: string;
    userId: string;
  };
};

async function up(db: Kysely<unknown>) {
  const typedDb = db.$extendTables<MigrationTables>();

  await typedDb
    .updateTable("account")
    .set((eb) => ({
      accountId: eb.cast<string>("userId", "text"),
    }))
    .where("providerId", "=", "credential")
    .where((eb) => eb("accountId", "!=", eb.cast<string>("userId", "text")))
    .execute();
}

async function down(_db: Kysely<unknown>) {
  // No-op: Better Auth 1.6 ignored `accountId` on credential rows, and 1.7+
  // requires it to equal `userId`, so every version works with `userId::text`.
}

export default { name: "RekeyCredentialAccountIds", up, down };
