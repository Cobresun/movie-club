#!/usr/bin/env tsx
// Measures GET /api/club/:slug/list/reviews for the clubs with the most
// reviewed works: per-phase DB timings, response size (raw / gzip / brotli),
// which externalData fields dominate the payload, and the deployed endpoint's
// end-to-end latency.
//
//   npx tsx --env-file=.env scripts/measure-reviews.ts [--top=5] [--runs=5]
//     [--base=https://movie-club.app] [slug ...]

import https from "node:https";
import { performance } from "node:perf_hooks";
import { brotliCompressSync, gzipSync } from "node:zlib";

import { WorkListSystemType } from "../lib/types/generated/db";
import ReviewRepository from "../netlify/functions/repositories/ReviewRepository";
import UserRepository from "../netlify/functions/repositories/UserRepository";
import { db, pool } from "../netlify/functions/utils/database";
import { getExternalSummariesForWorks } from "../netlify/functions/utils/providers";

const args = process.argv.slice(2);
const flag = (name: string, fallback: string) =>
  args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? fallback;
const top = Number(flag("top", "5"));
const runs = Number(flag("runs", "5"));
const base = flag("base", "https://movie-club.app");
const slugs = args.filter((a) => !a.startsWith("--"));

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`;
const ms = (t: number) => `${t.toFixed(0)} ms`;

async function timed<T>(fn: () => Promise<T>): Promise<[T, number]> {
  const start = performance.now();
  const value = await fn();
  return [value, performance.now() - start];
}

async function largestClubs() {
  let query = db
    .selectFrom("work_list")
    .innerJoin("club", "club.id", "work_list.club_id")
    .innerJoin("work_list_item", "work_list_item.list_id", "work_list.id")
    .where("work_list.system_type", "=", WorkListSystemType.reviews)
    .select((eb) => ["club.id", "club.slug", eb.fn.countAll<string>().as("works")])
    .groupBy(["club.id", "club.slug"])
    .orderBy("works", "desc");
  if (slugs.length > 0) query = query.where("club.slug", "in", slugs);
  return query.limit(slugs.length > 0 ? slugs.length : top).execute();
}

async function measureLocally(clubId: string) {
  const reviewTimes: number[] = [];
  const memberTimes: number[] = [];
  const summaryTimes: number[] = [];
  const totalTimes: number[] = [];
  let reviewRows = 0;
  let body = "";
  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    const [[reviews, rt], [, mt]] = await Promise.all([
      timed(() => ReviewRepository.getReviewList(clubId)),
      timed(() => UserRepository.getMembersByClubId(clubId)),
    ]);
    const [externalData, st] = await timed(() =>
      getExternalSummariesForWorks(
        reviews.map((r) => ({ externalId: r.external_id, type: r.type })),
      ),
    );
    totalTimes.push(performance.now() - start);
    reviewTimes.push(rt);
    memberTimes.push(mt);
    summaryTimes.push(st);
    reviewRows = reviews.length;
    body = JSON.stringify(Object.fromEntries(externalData));
  }
  return {
    reviewRows,
    reviewMs: median(reviewTimes),
    memberMs: median(memberTimes),
    summaryMs: median(summaryTimes),
    totalMs: median(totalTimes),
    externalDataBytes: Buffer.byteLength(body),
  };
}

function fetchDeployed(slug: string, encoding: string) {
  return new Promise<{ status: number; bytes: number; ttfb: number; total: number; body: Buffer }>(
    (resolve, reject) => {
      const start = performance.now();
      const req = https.get(
        `${base}/api/club/${slug}/list/reviews`,
        { headers: { "Accept-Encoding": encoding } },
        (res) => {
          const ttfb = performance.now() - start;
          const chunks: Buffer[] = [];
          res.on("data", (c: Buffer) => chunks.push(c));
          res.on("end", () => {
            const body = Buffer.concat(chunks);
            resolve({
              status: res.statusCode ?? 0,
              bytes: body.length,
              ttfb,
              total: performance.now() - start,
              body,
            });
          });
        },
      );
      req.on("error", reject);
    },
  );
}

// Top-level keys plus each externalData field (as `externalData.<key>`).
function fieldBreakdown(items: Record<string, unknown>[]) {
  const totals = new Map<string, number>();
  const add = (key: string, value: unknown) =>
    totals.set(key, (totals.get(key) ?? 0) + Buffer.byteLength(JSON.stringify(value)));
  for (const item of items) {
    for (const [key, value] of Object.entries(item)) {
      if (key === "externalData" && typeof value === "object" && value !== null) {
        for (const [field, inner] of Object.entries(value)) add(`externalData.${field}`, inner);
      } else {
        add(key, value);
      }
    }
  }
  return [...totals].sort((a, b) => b[1] - a[1]).slice(0, 15);
}

async function measureDeployed(slug: string) {
  const raw = await fetchDeployed(slug, "identity");
  if (raw.status !== 200) return { ok: false as const, status: raw.status };
  const compressed: Awaited<ReturnType<typeof fetchDeployed>>[] = [];
  for (let i = 0; i < runs; i++) compressed.push(await fetchDeployed(slug, "br, gzip"));
  const items = JSON.parse(raw.body.toString("utf8")) as Record<string, unknown>[];
  return {
    ok: true as const,
    works: items.length,
    rawBytes: raw.bytes,
    gzipBytes: gzipSync(raw.body).length,
    brotliBytes: brotliCompressSync(raw.body).length,
    servedCompressedBytes: compressed[0].bytes,
    ttfbMs: median(compressed.map((r) => r.ttfb)),
    totalMs: median(compressed.map((r) => r.total)),
    coldTtfbMs: raw.ttfb,
    fields: fieldBreakdown(items),
  };
}

const clubs = await largestClubs();
for (const club of clubs) {
  console.log(`\n=== ${club.slug} (${club.works} reviewed works) ===`);

  const local = await measureLocally(String(club.id));
  console.log(`DB, median of ${runs}, from this machine:`);
  console.log(`  review rows (work x score): ${local.reviewRows}`);
  console.log(`  ReviewRepository.getReviewList   ${ms(local.reviewMs)}`);
  console.log(`  UserRepository.getMembersByClubId ${ms(local.memberMs)}`);
  console.log(`  getExternalSummariesForWorks      ${ms(local.summaryMs)}`);
  console.log(`  total                             ${ms(local.totalMs)}`);
  console.log(`  externalData alone: ${kb(local.externalDataBytes)}`);

  const deployed = await measureDeployed(club.slug).catch((error: unknown) => {
    console.log(`${base}: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  });
  if (!deployed) continue;
  if (!deployed.ok) {
    console.log(`${base}: HTTP ${deployed.status}`);
    continue;
  }
  console.log(`${base}, median of ${runs}:`);
  console.log(`  works in response: ${deployed.works}`);
  console.log(
    `  body: ${kb(deployed.rawBytes)} raw, ${kb(deployed.gzipBytes)} gzip, ${kb(deployed.brotliBytes)} brotli`,
  );
  console.log(`  served with Accept-Encoding br/gzip: ${kb(deployed.servedCompressedBytes)}`);
  console.log(`  first request TTFB (may be cold): ${ms(deployed.coldTtfbMs)}`);
  console.log(`  warm TTFB ${ms(deployed.ttfbMs)}, total ${ms(deployed.totalMs)}`);
  console.log(`  largest fields across all works (raw):`);
  for (const [key, bytes] of deployed.fields) {
    console.log(
      `    ${key.padEnd(34)} ${kb(bytes).padStart(10)}  ${((bytes / deployed.rawBytes) * 100).toFixed(0)}%`,
    );
  }
}

await db.destroy();
await pool.end().catch(() => undefined);
