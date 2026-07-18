import { describe, expect, it } from "vitest";

import { WorkType } from "../../../../lib/types/generated/db";
import { mapDiaryRows, mapForWorkRows, DiaryStreamRow } from "../diaryMapping";

const soloRow: DiaryStreamRow = {
  review_id: "10",
  score: null,
  watched_date: new Date("2026-07-01T00:00:00.000Z"),
  created_date: new Date("2026-07-02T08:30:00.000Z"),
  rewatch: true,
  text: "A private note about the rewatch.",
  work_id: "100",
  work_title: "Solo Watched Film",
  work_type: WorkType.movie,
  work_external_id: "tt-solo",
  work_image_url: "https://img/solo.jpg",
  list_user_id: "42",
  club_id: null,
  club_name: null,
  club_slug: null,
};

const clubRow: DiaryStreamRow = {
  review_id: "20",
  score: "7.5",
  watched_date: null,
  created_date: new Date("2026-06-15T12:00:00.000Z"),
  rewatch: false,
  text: null,
  work_id: "200",
  work_title: "Club Reviewed Film",
  work_type: WorkType.book,
  work_external_id: "isbn-club",
  work_image_url: null,
  list_user_id: null,
  club_id: "5",
  club_name: "Cinephiles",
  club_slug: "cinephiles",
};

describe("mapDiaryRows", () => {
  it("derives a solo context when the list belongs to a user", () => {
    const [entry] = mapDiaryRows([soloRow]);
    expect(entry.context).toEqual({ kind: "solo" });
  });

  it("derives a club context from the joined club columns", () => {
    const [entry] = mapDiaryRows([clubRow]);
    expect(entry.context).toEqual({
      kind: "club",
      clubId: "5",
      clubName: "Cinephiles",
      clubSlug: "cinephiles",
    });
  });

  it("passes an unrated (null) score through as null", () => {
    const [entry] = mapDiaryRows([soloRow]);
    expect(entry.score).toBeNull();
  });

  it("coerces a numeric score string to a number", () => {
    const [entry] = mapDiaryRows([clubRow]);
    expect(entry.score).toBe(7.5);
  });

  it("passes private review text through, and null through as null", () => {
    const [solo, club] = mapDiaryRows([soloRow, clubRow]);
    expect(solo.text).toBe("A private note about the rewatch.");
    expect(club.text).toBeNull();
  });

  it("formats watched_date as YYYY-MM-DD and null as null", () => {
    const [solo, club] = mapDiaryRows([soloRow, clubRow]);
    expect(solo.watchedDate).toBe("2026-07-01");
    expect(club.watchedDate).toBeNull();
  });

  it("emits the created_date as an ISO timestamp", () => {
    const [solo] = mapDiaryRows([soloRow]);
    expect(solo.createdDate).toBe("2026-07-02T08:30:00.000Z");
  });

  it("accepts string date inputs (hand-written rows) and truncates them", () => {
    const [entry] = mapDiaryRows([
      { ...soloRow, watched_date: "2026-07-01T00:00:00.000Z" },
    ]);
    expect(entry.watchedDate).toBe("2026-07-01");
  });

  it("maps the work sub-object and rewatch flag", () => {
    const [entry] = mapDiaryRows([soloRow]);
    expect(entry.reviewId).toBe("10");
    expect(entry.rewatch).toBe(true);
    expect(entry.work).toEqual({
      id: "100",
      title: "Solo Watched Film",
      type: WorkType.movie,
      externalId: "tt-solo",
      imageUrl: "https://img/solo.jpg",
    });
  });
});

describe("mapForWorkRows", () => {
  it("returns diary events without the (known) work", () => {
    const [event] = mapForWorkRows([soloRow]);
    expect("work" in event).toBe(false);
    expect(event).toEqual({
      reviewId: "10",
      score: null,
      watchedDate: "2026-07-01",
      createdDate: "2026-07-02T08:30:00.000Z",
      rewatch: true,
      text: "A private note about the rewatch.",
      context: { kind: "solo" },
    });
  });
});
