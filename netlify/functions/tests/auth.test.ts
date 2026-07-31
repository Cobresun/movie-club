/**
 * Integration tests for `netlify/functions/auth.ts` — the adapter that bridges
 * a Netlify event to BetterAuth's Web `Request`/`Response` handler.
 *
 * Nothing about auth is stubbed here: real bcrypt hashing, real `account` and
 * `session` rows in CockroachDB, real signed cookies. Only the verification
 * email leaves the process, and MSW catches that at Resend's endpoint.
 */
import { describe, expect, it } from "vitest";

import { handler } from "../auth";
import { db } from "./helpers/database";
import { requester } from "./helpers/http";
import { requestsTo } from "./setup/externalApis";

const api = requester(handler);

const PASSWORD = "correct-horse-battery-staple";

let counter = 0;
const freshEmail = () => `signup-${Date.now().toString(36)}-${(counter += 1)}@movie.club`;

async function signUp<T = { user: { id: string } }>(email: string) {
  return api.post<T>("/api/auth/sign-up/email", {
    body: { email, password: PASSWORD, name: "New User" },
    headers: { "content-type": "application/json", host: "localhost:8888" },
  });
}

function signInRequest(email: string, password = PASSWORD) {
  return api.post("/api/auth/sign-in/email", {
    body: { email, password },
    headers: { "content-type": "application/json", host: "localhost:8888" },
  });
}

async function verify(email: string) {
  await db.updateTable("user").set({ emailVerified: true }).where("email", "=", email).execute();
}

describe("POST /api/auth/sign-up/email", () => {
  it("creates the user and sends a verification email", async () => {
    const email = freshEmail();

    const res = await signUp(email);

    expect(res.statusCode).toBe(200);
    const user = await db
      .selectFrom("user")
      .select(["name", "emailVerified"])
      .where("email", "=", email)
      .executeTakeFirstOrThrow();
    expect(user).toEqual({ name: "New User", emailVerified: false });
    expect(requestsTo("api.resend.com")).toHaveLength(1);
  });

  it("stores a hashed password, never the password itself", async () => {
    const email = freshEmail();

    await signUp(email);

    const account = await db
      .selectFrom("account")
      .innerJoin("user", "user.id", "account.userId")
      .select("account.password")
      .where("user.email", "=", email)
      .executeTakeFirstOrThrow();
    expect(account.password).not.toBe(PASSWORD);
    expect(account.password).toMatch(/^\$2[aby]\$/);
  });

  it("answers a repeat sign-up with a decoy instead of creating a second user", async () => {
    const email = freshEmail();
    const first = await signUp(email);
    const original = await db
      .selectFrom("user")
      .select("id")
      .where("email", "=", email)
      .executeTakeFirstOrThrow();

    const second = await signUp<{ user: { id: string } }>(email);

    // BetterAuth deliberately reports success so the endpoint cannot be used
    // to enumerate registered addresses — the id it hands back is a decoy.
    expect(second.statusCode).toBe(200);
    expect(second.body.user.id).not.toBe(first.body.user.id);

    const users = await db.selectFrom("user").select("id").where("email", "=", email).execute();
    expect(users).toEqual([{ id: original.id }]);
  });
});

describe("POST /api/auth/sign-in/email", () => {
  it("returns both session cookies through multiValueHeaders", async () => {
    const email = freshEmail();
    await signUp(email);
    await verify(email);

    const res = await signInRequest(email);

    expect(res.statusCode).toBe(200);
    // The Headers API folds repeated Set-Cookie into one comma-joined value,
    // which browsers parse as a single broken cookie. With the session
    // cookieCache on, sign-in legitimately sets two, so they have to travel
    // through multiValueHeaders.
    const cookies = res.multiValueHeaders["Set-Cookie"];
    expect(cookies.length).toBeGreaterThanOrEqual(2);
    expect(cookies.some((cookie) => cookie.startsWith("better-auth.session_token="))).toBe(true);
    expect(res.headers).not.toHaveProperty("set-cookie");
  });

  it("opens a session row the get-session endpoint then resolves", async () => {
    const email = freshEmail();
    await signUp(email);
    await verify(email);

    const signedIn = await signInRequest(email);
    const cookie = signedIn.multiValueHeaders["Set-Cookie"]
      .map((setCookie) => setCookie.split(";")[0])
      .join("; ");

    const session = await api.get<{ user: { email: string } }>("/api/auth/get-session", {
      headers: { cookie, host: "localhost:8888" },
    });

    expect(session.statusCode).toBe(200);
    expect(session.body.user.email).toBe(email);
  });

  it("refuses the wrong password", async () => {
    const email = freshEmail();
    await signUp(email);
    await verify(email);

    const res = await signInRequest(email, "not-the-password");

    expect(res.statusCode).toBe(401);
  });

  it("refuses an address that has not been verified", async () => {
    const email = freshEmail();
    await signUp(email);

    const res = await signInRequest(email);

    expect(res.statusCode).toBe(403);
  });

  it("refuses an unknown address", async () => {
    const res = await signInRequest("nobody@movie.club");

    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });
});

describe("GET /api/auth/get-session", () => {
  it("returns an empty session for a request with no cookie", async () => {
    const res = await api.get("/api/auth/get-session", { headers: { host: "localhost:8888" } });

    expect(res.statusCode).toBe(200);
    expect(res.body).toBeNull();
  });
});
