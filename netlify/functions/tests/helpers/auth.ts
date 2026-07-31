import { auth } from "../../utils/auth";
import { db } from "../../utils/database";

/**
 * Real BetterAuth identities for the integration suite.
 *
 * Nothing here fakes authentication: users are created through
 * `auth.api.signUpEmail` (bcrypt hash, `account` row, verification email sent
 * through the mocked Resend endpoint) and sessions through
 * `auth.api.signInEmail`, so the cookie a test sends is the same signed cookie
 * a browser would, and `loggedIn` / `secured` verify it for real.
 */

const PASSWORD = "integration-test-password";

/**
 * Stable identities shared by the whole run. `helpers/database.ts` leaves the
 * auth tables alone between tests, so signing these three in costs a handful of
 * bcrypt hashes per file rather than per test.
 */
export const FIXTURE_USERS = {
  alice: { email: "alice@movie.club", name: "Alice" },
  bob: { email: "bob@movie.club", name: "Bob" },
  carol: { email: "carol@movie.club", name: "Carol" },
} as const;

export type FixtureUser = keyof typeof FIXTURE_USERS;

export interface TestSession {
  userId: string;
  email: string;
  name: string;
  /** `cookie` request header carrying the signed BetterAuth session token. */
  cookie: string;
}

const sessions = new Map<string, TestSession>();

async function findUserId(email: string): Promise<string | undefined> {
  const row = await db
    .selectFrom("user")
    .select("id")
    .where("email", "=", email)
    .executeTakeFirst();
  return row ? String(row.id) : undefined;
}

/**
 * Sign a fixture user in, creating the account on first use. The returned
 * session is cached, so repeated calls in one file are free.
 */
export async function signIn(who: FixtureUser): Promise<TestSession> {
  const cached = sessions.get(who);
  if (cached) return cached;

  const { email, name } = FIXTURE_USERS[who];

  if ((await findUserId(email)) === undefined) {
    await auth.api.signUpEmail({ body: { email, password: PASSWORD, name } });
    // `requireEmailVerification` is on, so sign-in fails until the address is
    // confirmed. Clicking a link from the (mocked) email is not what these
    // tests are about, so flip the column directly.
    await db.updateTable("user").set({ emailVerified: true }).where("email", "=", email).execute();
  }

  const response = await auth.api.signInEmail({
    body: { email, password: PASSWORD },
    asResponse: true,
  });

  if (!response.ok) {
    throw new Error(`Failed to sign in ${email}: ${response.status} ${await response.text()}`);
  }

  const cookie = response.headers
    .getSetCookie()
    .map((setCookie) => setCookie.split(";")[0])
    .join("; ");

  const session = await auth.api.getSession({ headers: new Headers({ cookie }) });
  const userId = session?.user.id;
  if (userId === undefined) {
    throw new Error(`Signed in ${email} but the session cookie did not resolve to a user`);
  }

  const testSession: TestSession = { userId, email, name, cookie };
  sessions.set(who, testSession);
  return testSession;
}

/**
 * Undo any mutation a test made to the shared fixture users (the profile
 * endpoints rename them and set avatars). The auth tables survive
 * `resetDatabase()`, so without this a rename would leak into the next test.
 */
export async function restoreFixtureUsers() {
  await Promise.all(
    Object.values(FIXTURE_USERS).map(({ email, name }) =>
      db
        .updateTable("user")
        .set({ name, image: null, image_id: null })
        .where("email", "=", email)
        .execute(),
    ),
  );
}
