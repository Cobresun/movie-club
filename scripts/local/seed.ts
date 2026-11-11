#!/usr/bin/env tsx

import { setTimeout as sleep } from "timers/promises";
import { z } from "zod";

import { type ClubPreview, type CreatedClubResponse } from "../../lib/types/club.js";
import { ClubType } from "../../lib/types/generated/db.js";

/**
 * Seeds a local stack (`npm run local:up` + `netlify dev`) through the app's
 * own endpoints, the way the integration factories do: two users signed up and
 * verified by following the link out of the local mailbox, and one club of
 * each type with both as members. Re-running skips whatever already exists.
 */

const APP_URL = process.env.LOCAL_APP_URL ?? "http://localhost:8888";
const MAILBOX_URL = `http://localhost:${process.env.MAILBOX_PORT ?? "8025"}`;
const PASSWORD = "movie-club-local";

const USERS = [
  { email: "dev@movie.club", name: "Dev User" },
  { email: "friend@movie.club", name: "Friend" },
] as const;

const CLUB_NAMES: Record<ClubType, string> = {
  [ClubType.MOVIE]: "Local Movie Club",
  [ClubType.BOOK]: "Local Book Club",
  [ClubType.TV]: "Local TV Club",
};

const mailboxSchema = z.array(z.object({ html: z.string() }));
const clubPreviewsSchema = z.array(z.object({ clubName: z.string(), slug: z.string() }));
const createdClubSchema = z.object({ slug: z.string() });

/** BetterAuth rejects cookie-bearing POSTs from an origin it does not trust. */
const HEADERS = { "content-type": "application/json", origin: APP_URL };

async function post(path: string, body: unknown, cookie?: string) {
  return fetch(`${APP_URL}${path}`, {
    method: "POST",
    headers: cookie === undefined ? HEADERS : { ...HEADERS, cookie },
    body: JSON.stringify(body),
    redirect: "manual",
  });
}

function cookieFrom(response: Response) {
  return response.headers
    .getSetCookie()
    .map((setCookie) => setCookie.split(";")[0])
    .join("; ");
}

async function verificationLink(email: string): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const response = await fetch(`${MAILBOX_URL}/emails?to=${encodeURIComponent(email)}`);
    const [latest] = mailboxSchema.parse(await response.json());
    const link = /href="(?<href>[^"]*verify-email[^"]*)"/u.exec(latest?.html ?? "")?.groups?.href;
    if (link !== undefined) return link.replaceAll("&amp;", "&");
    await sleep(250);
  }
  throw new Error(`No verification email reached ${MAILBOX_URL} for ${email}`);
}

async function signIn(email: string, name: string): Promise<string> {
  const existing = await post("/api/auth/sign-in/email", { email, password: PASSWORD });
  if (existing.ok) return cookieFrom(existing);

  const signedUp = await post("/api/auth/sign-up/email", { email, password: PASSWORD, name });
  if (!signedUp.ok) {
    throw new Error(`Signing up ${email} failed: ${signedUp.status} ${await signedUp.text()}`);
  }

  const verified = await fetch(await verificationLink(email), { redirect: "manual" });
  if (verified.status >= 400) {
    throw new Error(`Verifying ${email} failed: ${verified.status} ${await verified.text()}`);
  }

  const signedIn = await post("/api/auth/sign-in/email", { email, password: PASSWORD });
  if (!signedIn.ok) {
    throw new Error(`Signing in ${email} failed: ${signedIn.status} ${await signedIn.text()}`);
  }
  console.log(`Created ${email}`);
  return cookieFrom(signedIn);
}

async function main() {
  const [owner] = await Promise.all(USERS.map(({ email, name }) => signIn(email, name)));

  const clubsResponse = await fetch(`${APP_URL}/api/member/clubs`, { headers: { cookie: owner } });
  const clubs: Pick<ClubPreview, "clubName" | "slug">[] = clubPreviewsSchema.parse(
    await clubsResponse.json(),
  );

  for (const type of Object.values(ClubType)) {
    const name = CLUB_NAMES[type];
    const existing = clubs.find((club) => club.clubName === name);
    if (existing !== undefined) {
      console.log(`Kept ${name}: ${APP_URL}/club/${existing.slug}`);
      continue;
    }

    const response = await post(
      "/api/club",
      { name, type, members: USERS.map((user) => user.email) },
      owner,
    );
    if (!response.ok) {
      throw new Error(`Creating ${name} failed: ${response.status} ${await response.text()}`);
    }
    const created: Pick<CreatedClubResponse, "slug"> = createdClubSchema.parse(
      await response.json(),
    );
    console.log(`Created ${name}: ${APP_URL}/club/${created.slug}`);
  }

  console.log(`\nSign in at ${APP_URL} as ${USERS[0].email} / ${PASSWORD}`);
  console.log(`Sent mail: ${MAILBOX_URL}`);
}

await main();
