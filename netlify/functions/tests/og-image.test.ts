/**
 * Integration tests for `netlify/functions/og-image.ts` — the Open Graph image
 * a shared review link unfurls to. Runs against real club, work and review rows
 * through `SharedReviewService`.
 */
import { describe, expect, it } from "vitest";

import { handler } from "../og-image";
import {
  addMember,
  createClub,
  createReview,
  createReviewedWork,
  createUser,
} from "./helpers/factories";
import { requester } from "./helpers/http";

const api = requester(handler);

describe("GET /api/og-image", () => {
  it("redirects to the work's own image when it has one", async () => {
    const club = await createClub();
    const work = await createReviewedWork(club, {
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
    const club = await createClub();
    const first = await createUser({ name: "First" });
    const second = await createUser({ name: "Second" });
    await addMember(club.id, first.userId);
    await addMember(club.id, second.userId);
    const work = await createReviewedWork(club, {
      externalId: null,
      imageUrl: null,
      title: "No Poster",
    });
    await createReview(club.reviewsListId, work.id, first.userId, 8);
    await createReview(club.reviewsListId, work.id, second.userId, 7);

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
    const club = await createClub();
    const work = await createReviewedWork(club, { externalId: null, imageUrl: null });

    const res = await api.get<string>("/api/og-image", {
      query: { clubSlug: club.slug, workId: work.id },
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain("N/A");
    // Known wart, pinned here rather than fixed in a test-only change: the
    // rating count comes from the raw query rows, and `getReviewsByWorkId`
    // left-joins `review`, so an unscored work still yields one (all-null)
    // row. The card therefore reads "from 1 rating" with no ratings at all.
    // Counting `scores` instead of `reviews` in og-image.ts is the fix.
    expect(res.body).toContain("from 1 rating");
  });

  it("escapes XML-significant characters in the title", async () => {
    const club = await createClub();
    const work = await createReviewedWork(club, {
      externalId: null,
      imageUrl: null,
      title: "Fish & <Chips>",
    });

    const res = await api.get<string>("/api/og-image", {
      query: { clubSlug: club.slug, workId: work.id },
    });

    expect(res.body).toContain("Fish &amp; &lt;Chips&gt;");
  });

  it("falls back to a generic card when the work does not exist", async () => {
    const club = await createClub();

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
