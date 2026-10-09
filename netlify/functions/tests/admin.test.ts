/**
 * Integration tests for `netlify/functions/admin.ts` — the site-metrics
 * endpoints behind the `/admin` dashboard.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SIGNUP_SOURCE_COOKIE } from "../../../lib/signupSource";
import { SignupSource } from "../../../lib/types/generated/db";
import { SignupSourceCount, SiteMetrics } from "../../../lib/types/metrics";
import { handler as adminHandler } from "../admin";
import { FIXTURE_USERS, signIn, signUpNewUser } from "./helpers/auth";
import { requester } from "./helpers/http";

const api = requester(adminHandler);

async function signupSources(): Promise<SignupSourceCount[]> {
  const alice = await signIn("alice");
  const res = await api.get<SiteMetrics>("/api/admin/metrics", { as: alice });
  expect(res.statusCode).toBe(200);
  return res.body.signupSources;
}

async function countFrom(source: SignupSource | null) {
  const row = (await signupSources()).find((count) => count.source === source);
  return row ?? { source, users: 0, last30Days: 0, activated: 0 };
}

describe("signup sources", () => {
  beforeEach(() => {
    vi.stubEnv("ADMIN_USER_EMAILS", FIXTURE_USERS.alice.email);
  });

  it("reports every channel, even before anyone has signed up through it", async () => {
    const sources = (await signupSources()).map((row) => row.source);

    expect(sources).toEqual(expect.arrayContaining(Object.values(SignupSource)));
  });

  it("credits a signup to the channel its browser arrived through", async () => {
    const before = await countFrom(SignupSource.invite);

    await signUpNewUser("invited@movie.club", "Invited", {
      cookie: `${SIGNUP_SOURCE_COOKIE}=${SignupSource.invite}`,
    });

    expect(await countFrom(SignupSource.invite)).toEqual({
      source: SignupSource.invite,
      users: before.users + 1,
      last30Days: before.last30Days + 1,
      activated: before.activated,
    });
  });

  it("counts a signup with no recognisable channel as not recorded", async () => {
    const before = await countFrom(null);

    await signUpNewUser("mystery@movie.club", "Mystery", {
      cookie: `${SIGNUP_SOURCE_COOKIE}=carrier-pigeon`,
    });

    expect((await countFrom(null)).users).toBe(before.users + 1);
  });

  it("keeps the numbers from anyone not on the admin allowlist", async () => {
    const bob = await signIn("bob");

    const res = await api.get("/api/admin/metrics", { as: bob });

    expect(res.statusCode).toBe(401);
  });
});
