import { handler as authHandler } from "../../auth";
import { handler as memberHandler } from "../../member";
import { handler as memberAvatarHandler } from "../../member-avatar";
import { lastEmailTo, sentEmails } from "../setup/externalApis";
import { requester } from "./http";

/**
 * Real BetterAuth identities for the integration suite.
 *
 * Nothing here is faked or shortcut. A fixture user is created by posting to
 * `/api/auth/sign-up/email`, confirmed by following the link out of the
 * verification email BetterAuth sends (captured at Resend's endpoint by MSW),
 * and signed in through `/api/auth/sign-in/email` — the same three requests a
 * browser makes. The cookie a test then sends is the real signed session
 * cookie, and `loggedIn` / `secured` verify it against real `session` rows.
 */

const auth = requester(authHandler);

const PASSWORD = "integration-test-password";

/** BetterAuth reads the host header to build absolute URLs. */
const AUTH_HEADERS = { "content-type": "application/json", host: "localhost:8888" };

/**
 * Stable identities shared by the whole run. `helpers/database.ts` leaves the
 * auth tables alone between tests, so these are created once and thereafter
 * only signed in again — a handful of bcrypt hashes per file rather than per
 * test.
 */
export const FIXTURE_USERS = {
  alice: { email: "alice@movie.club", name: "Alice" },
  bob: { email: "bob@movie.club", name: "Bob" },
  carol: { email: "carol@movie.club", name: "Carol" },
  dave: { email: "dave@movie.club", name: "Dave" },
  erin: { email: "erin@movie.club", name: "Erin" },
} as const;

export type FixtureUser = keyof typeof FIXTURE_USERS;

export interface TestSession {
  userId: string;
  email: string;
  name: string;
  /** `cookie` request header carrying the signed BetterAuth session token. */
  cookie: string;
}

/**
 * Signed-in fixture users, with the moment BetterAuth will stop honouring the
 * cookie. Tests that fake `Date` sign in at their fake time, so a session can
 * already be expired by the real clock a later test runs on.
 */
const sessions = new Map<string, { session: TestSession; expiresAt: Date }>();

/** Collapse a Set-Cookie list into the `cookie` header a browser would send back. */
function toCookieHeader(setCookies: string[]): string {
  return setCookies.map((setCookie) => setCookie.split(";")[0]).join("; ");
}

/**
 * Pull the verification link out of the email BetterAuth just sent and follow
 * it, which is what confirms the address. Returns the path + query so the
 * request goes back through the auth handler rather than over the network.
 */
async function confirmEmailAddress(email: string) {
  const message = lastEmailTo(email);
  if (!message) {
    throw new Error(`No verification email was sent to ${email}`);
  }

  const link = /href="(?<href>[^"]*verify-email[^"]*)"/u.exec(message.html)?.[1];
  if (link === undefined) {
    throw new Error(`The email sent to ${email} carried no verification link`);
  }

  const url = new URL(link.replaceAll("&amp;", "&"));
  const verified = await auth.get(`${url.pathname}${url.search}`, { headers: AUTH_HEADERS });

  // BetterAuth redirects to the callback URL once the token checks out.
  if (verified.statusCode >= 400) {
    throw new Error(`Verifying ${email} failed: ${verified.statusCode} ${verified.raw ?? ""}`);
  }
}

async function signUp(email: string, name: string, headers: Record<string, string> = {}) {
  const response = await auth.post("/api/auth/sign-up/email", {
    body: { email, password: PASSWORD, name },
    headers: { ...AUTH_HEADERS, ...headers },
  });
  if (response.statusCode >= 400) {
    throw new Error(`Signing up ${email} failed: ${response.statusCode} ${response.raw ?? ""}`);
  }
  await confirmEmailAddress(email);
}

async function signInRequest(email: string) {
  return auth.post("/api/auth/sign-in/email", {
    body: { email, password: PASSWORD },
    headers: AUTH_HEADERS,
  });
}

/** Turn a successful sign-in response into a session tests can send. */
async function toTestSession(
  response: Awaited<ReturnType<typeof signInRequest>>,
  email: string,
  name: string,
) {
  if (response.statusCode >= 400) {
    throw new Error(`Signing in ${email} failed: ${response.statusCode} ${response.raw ?? ""}`);
  }

  const cookie = toCookieHeader(response.multiValueHeaders["Set-Cookie"] ?? []);
  const resolved = await auth.get<{
    session: { expiresAt: string };
    user: { id: string };
  } | null>("/api/auth/get-session", {
    headers: { ...AUTH_HEADERS, cookie },
  });
  if (!resolved.body) {
    throw new Error(`Signed in ${email} but the session cookie did not resolve to a user`);
  }

  const session: TestSession = { userId: resolved.body.user.id, email, name, cookie };
  return { session, expiresAt: new Date(resolved.body.session.expiresAt) };
}

/**
 * Sign a fixture user in, creating and verifying the account on first use. The
 * session is cached, so repeated calls within a file are free, until it has
 * expired by the clock the calling test runs on.
 */
export async function signIn(who: FixtureUser): Promise<TestSession> {
  const cached = sessions.get(who);
  if (cached && cached.expiresAt.getTime() > Date.now()) return cached.session;

  const { email, name } = FIXTURE_USERS[who];

  let response = await signInRequest(email);

  // 403 means the account exists but is unverified, 401 that it does not exist
  // at all; either way this is the first time this run has needed it.
  if (response.statusCode >= 400) {
    await signUp(email, name);
    response = await signInRequest(email);
  }

  const signedIn = await toTestSession(response, email, name);
  sessions.set(who, signedIn);
  return signedIn.session;
}

/**
 * Sign up, verify and sign in an address outside the fixture set, for a test
 * that does something to the account no other test may see, like deleting it.
 * The password is `FIXTURE_PASSWORD`.
 */
export async function signInNewUser(email: string, name = "New User"): Promise<TestSession> {
  await signUpNewUser(email, name);
  return (await toTestSession(await signInRequest(email), email, name)).session;
}

/**
 * Sign-up for an address outside the fixture set, e.g. to test the flow itself.
 * `headers` ride on the sign-up request, as a browser's cookies would.
 */
export async function signUpNewUser(
  email: string,
  name = "New User",
  headers: Record<string, string> = {},
) {
  await signUp(email, name, headers);
  sentEmails.length = 0;
}

/**
 * Undo any profile change a test made to a fixture user.
 *
 * The auth tables survive `resetDatabase()`, so a rename or an avatar upload
 * would otherwise leak into the next test — and, because sessions are cached
 * for the whole file, into the next file. Restoring goes through the profile
 * endpoints rather than the database, for the same reason the tests do.
 */
export async function restoreFixtureUsers() {
  const member = requester(memberHandler);
  const avatar = requester(memberAvatarHandler);
  for (const { session } of sessions.values()) {
    await member.put("/api/member/name", { body: { name: session.name }, as: session });
    await avatar.delete("/api/member/avatar", { as: session });
  }
}

export { PASSWORD as FIXTURE_PASSWORD, AUTH_HEADERS };
