import { describe, expect, it } from "vitest";

import { bucketStart, fillBuckets } from "../timeBuckets";

const at = (iso: string) => new Date(iso);
const empty = (bucket: string) => ({ bucket, count: 0 });

describe("bucketStart", () => {
  it("truncates to UTC midnight for days", () => {
    expect(bucketStart("day", at("2026-09-26T23:59:00Z")).toISOString()).toBe(
      "2026-09-26T00:00:00.000Z",
    );
  });

  it("goes back to the Monday for weeks, as date_trunc does", () => {
    // 2026-09-26 is a Saturday; 2026-09-21 the Monday before.
    expect(bucketStart("week", at("2026-09-26T12:00:00Z")).toISOString()).toBe(
      "2026-09-21T00:00:00.000Z",
    );
    // A Sunday belongs to the week that started six days earlier, not the next one.
    expect(bucketStart("week", at("2026-09-27T12:00:00Z")).toISOString()).toBe(
      "2026-09-21T00:00:00.000Z",
    );
    expect(bucketStart("week", at("2026-09-21T00:00:00Z")).toISOString()).toBe(
      "2026-09-21T00:00:00.000Z",
    );
  });

  it("goes back to the first for months", () => {
    expect(bucketStart("month", at("2026-02-28T18:00:00Z")).toISOString()).toBe(
      "2026-02-01T00:00:00.000Z",
    );
  });
});

describe("fillBuckets", () => {
  it("zero-fills the buckets the query left out", () => {
    const filled = fillBuckets(
      "day",
      at("2026-09-01T15:00:00Z"),
      at("2026-09-04T09:00:00Z"),
      [{ bucket: "2026-09-02", count: 5 }],
      empty,
    );

    expect(filled).toEqual([
      { bucket: "2026-09-01", count: 0 },
      { bucket: "2026-09-02", count: 5 },
      { bucket: "2026-09-03", count: 0 },
      { bucket: "2026-09-04", count: 0 },
    ]);
  });

  it("steps months of uneven length without drifting", () => {
    const filled = fillBuckets(
      "month",
      at("2025-12-15T00:00:00Z"),
      at("2026-03-02T00:00:00Z"),
      [],
      empty,
    );

    expect(filled.map((row) => row.bucket)).toEqual([
      "2025-12-01",
      "2026-01-01",
      "2026-02-01",
      "2026-03-01",
    ]);
  });

  it("steps weeks across a year boundary", () => {
    const filled = fillBuckets(
      "week",
      at("2025-12-24T00:00:00Z"),
      at("2026-01-13T00:00:00Z"),
      [],
      empty,
    );

    expect(filled.map((row) => row.bucket)).toEqual([
      "2025-12-22",
      "2025-12-29",
      "2026-01-05",
      "2026-01-12",
    ]);
  });
});
