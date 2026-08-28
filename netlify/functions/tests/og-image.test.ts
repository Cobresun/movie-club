/**
 * Integration tests for `netlify/functions/og-image.ts` — the Open Graph image
 * a shared review link unfurls to.
 */
import { describe, expect, it } from "vitest";

import { handler } from "../og-image";
import { signIn } from "./helpers/auth";
import { addReviewedWork, createClub, scoreWork } from "./helpers/factories";
import { requester } from "./helpers/http";

const api = requester(handler);

describe("GET /api/og-image", () => {
  it("redirects to the work's own image when it has one", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    const work = await addReviewedWork(club, alice, {
      externalId: null,
      imageUrl: "https://image.tmdb.org/t/p/w500/poster.jpg",
    });

    const res = await api.get("/api/og-image", {
      query: { clubSlug: club.slug, workId: work.id },
    });

    expect(res.statusCode).toBe(302);
    expect(res.headers.Location).toBe("https://image.tmdb.org/t/p/w500/poster.jpg");
  });

  it("renders an SVG card with the title, average score and rating count", async () => {
    const alice = await signIn("alice");
    const bob = await signIn("bob");
    const club = await createClub(alice, { members: [alice, bob] });
    const work = await addReviewedWork(club, alice, { title: "No Poster", externalId: null });
    await scoreWork(club, alice, work.id, 8);
    await scoreWork(club, bob, work.id, 7);

    const res = await api.get<string>("/api/og-image", {
      query: { clubSlug: club.slug, workId: work.id },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers["Content-Type"]).toBe("image/svg+xml");
    expect(res.body).toContain("No Poster");
    expect(res.body).toContain("7.5");
    expect(res.body).toContain("from 2 ratings");
  });

  it("says N/A when nobody has scored the work", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    const work = await addReviewedWork(club, alice, { externalId: null });

    const res = await api.get<string>("/api/og-image", {
      query: { clubSlug: club.slug, workId: work.id },
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain("N/A");
    expect(res.body).toContain("from 0 ratings");
  });

  it("escapes XML-significant characters in the title", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    const work = await addReviewedWork(club, alice, {
      title: "Fish & <Chips>",
      externalId: null,
    });

    const res = await api.get<string>("/api/og-image", {
      query: { clubSlug: club.slug, workId: work.id },
    });

    expect(res.body).toContain("Fish &amp; &lt;Chips&gt;");
  });

  it("falls back to a generic card when the work does not exist", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);

    const res = await api.get<string>("/api/og-image", {
      query: { clubSlug: club.slug, workId: "999999" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain("Movie Review");
    expect(res.body).toContain("N/A");
  });

  it.each([
    ["clubSlug", { workId: "1" }],
    ["workId", { clubSlug: "some-club" }],
    ["both parameters", {}],
  ])("returns 400 when %s is missing", async (_label, query) => {
    const res = await api.get("/api/og-image", { query });

    expect(res.statusCode).toBe(400);
  });

  it("returns 404 for an unknown club", async () => {
    const res = await api.get("/api/og-image", {
      query: { clubSlug: "no-such-club", workId: "1" },
    });

    expect(res.statusCode).toBe(404);
  });
});
