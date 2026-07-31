/**
 * Integration tests for `netlify/functions/auth.ts` — the adapter that bridges
 * a Netlify event to BetterAuth's Web `Request`/`Response` handler.
 *
 * Nothing about auth is stubbed: real bcrypt hashing, real `account` and
 * `session` rows in CockroachDB, real signed cookies. Only the verification
 * email leaves the process, and MSW catches that at Resend's endpoint — which
 * is also how these tests read the confirmation link, exactly as a user would.
 */
import { describe, expect, it } from "vitest";

import { handler } from "../auth";
import { handler as clubHandler } from "../club/index";
import { AUTH_HEADERS } from "./helpers/auth";
import { requester } from "./helpers/http";
import { lastEmailTo } from "./setup/externalApis";

const api = requester(handler);
const clubApi = requester(clubHandler);

const PASSWORD = "correct-horse-battery-staple";

let counter = 0;
const freshEmail = () => `signup-${Date.now().toString(36)}-${(counter += 1)}@movie.club`;

function signUp<T = { user: { id: string } }>(email: string, password = PASSWORD) {
  return api.post<T>("/api/auth/sign-up/email", {
    body: { email, password, name: "New User" },
    headers: AUTH_HEADERS,
  });
}

function signInRequest(email: string, password = PASSWORD) {
  return api.post("/api/auth/sign-in/email", {
    body: { email, password },
    headers: AUTH_HEADERS,
  });
}

/** Click the link out of the verification email, as a new user would. */
async function followVerificationLink(email: string) {
  const message = lastEmailTo(email);
  if (!message) throw new Error(`No email was sent to ${email}`);
  const link = /href="([^"]*verify-email[^"]*)"/.exec(message.html)?.[1];
  if (link === undefined) throw new Error(`The email to ${email} carried no verification link`);
  const url = new URL(link.replaceAll("&amp;", "&"));
  return api.get(`${url.pathname}${url.search}`, { headers: AUTH_HEADERS });
}

function cookieFrom(response: { multiValueHeaders: Record<string, string[]> }) {
  return (response.multiValueHeaders["Set-Cookie"] ?? [])
    .map((setCookie) => setCookie.split(";")[0])
    .join("; ");
}

describe("POST /api/auth/sign-up/email", () => {
  it("emails the new address a verification link", async () => {
    const email = freshEmail();

    const res = await signUp(email);

    expect(res.statusCode).toBe(200);
    const message = lastEmailTo(email);
    expect(message?.subject).toMatch(/verify/i);
    expect(message?.html).toContain("verify-email");
  });

  it("refuses to sign the new account in until that link is followed", async () => {
    const email = freshEmail();
    await signUp(email);

    expect((await signInRequest(email)).statusCode).toBe(403);

    const verified = await followVerificationLink(email);
    expect(verified.statusCode).toBeLessThan(400);
    expect((await signInRequest(email)).statusCode).toBe(200);
  });

  it("answers a repeat sign-up with a decoy rather than touching the account", async () => {
    const email = freshEmail();
    const first = await signUp(email);
    await followVerificationLink(email);

    const second = await signUp(email, "a-different-password");

    // BetterAuth deliberately reports success so the endpoint cannot be used
    // to enumerate registered addresses — the id it hands back is a decoy.
    expect(second.statusCode).toBe(200);
    expect(second.body.user.id).not.toBe(first.body.user.id);

    // The original credentials still work and the second password does not, so
    // nothing about the real account changed.
    expect((await signInRequest(email)).statusCode).toBe(200);
    expect((await signInRequest(email, "a-different-password")).statusCode).toBe(401);
  });
});

describe("POST /api/auth/sign-in/email", () => {
  it("returns both session cookies through multiValueHeaders", async () => {
    const email = freshEmail();
    await signUp(email);
    await followVerificationLink(email);

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

  it("opens a session the rest of the API accepts", async () => {
    const email = freshEmail();
    await signUp(email);
    await followVerificationLink(email);
    const cookie = cookieFrom(await signInRequest(email));

    const session = await api.get<{ user: { email: string } }>("/api/auth/get-session", {
      headers: { ...AUTH_HEADERS, cookie },
    });
    expect(session.statusCode).toBe(200);
    expect(session.body.user.email).toBe(email);

    // The same cookie satisfies `loggedIn` on an ordinary club route.
    const clubs = await clubApi.post<{ slug: string }>("/api/club", {
      body: { name: "Brand New Club", members: [email] },
      headers: { cookie },
    });
    expect(clubs.statusCode).toBe(200);
  });

  it("refuses the wrong password", async () => {
    const email = freshEmail();
    await signUp(email);
    await followVerificationLink(email);

    const res = await signInRequest(email, "not-the-password");

    expect(res.statusCode).toBe(401);
    expect(res.multiValueHeaders["Set-Cookie"]).toBeUndefined();
  });

  it("refuses an unknown address", async () => {
    const res = await signInRequest("nobody@movie.club");

    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });
});

describe("GET /api/auth/get-session", () => {
  it("returns an empty session for a request with no cookie", async () => {
    const res = await api.get("/api/auth/get-session", { headers: AUTH_HEADERS });

    expect(res.statusCode).toBe(200);
    expect(res.body).toBeNull();
  });

  it("returns an empty session for a forged cookie", async () => {
    const res = await api.get("/api/auth/get-session", {
      headers: { ...AUTH_HEADERS, cookie: "better-auth.session_token=not-a-real-token" },
    });

    expect(res.body).toBeNull();
  });
});
