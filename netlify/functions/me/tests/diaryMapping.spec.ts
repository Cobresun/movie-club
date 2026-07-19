import { describe, expect, it } from "vitest";

import { WorkType } from "../../../../lib/types/generated/db";
import {
  mapDiaryRows,
  mapForWorkRows,
  ClubReviewRow,
  WatchStreamRow,
} from "../diaryMapping";

const soloWatch: WatchStreamRow = {
  watch_id: "10",
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
};

const reviewedWatch: WatchStreamRow = {
  watch_id: "20",
  score: "7.5",
  watched_date: null,
  created_date: new Date("2026-06-12T12:00:00.000Z"),
  rewatch: false,
  text: null,
  work_id: "200",
  work_title: "Club Reviewed Film",
  work_type: WorkType.book,
  work_external_id: "isbn-club",
  work_image_url: null,
};

const clubReviews: ClubReviewRow[] = [
  {
    review_id: "31",
    watch_id: "20",
    created_date: new Date("2026-06-13T12:00:00.000Z"),
    club_id: "5",
    club_name: "Cinephiles",
    club_slug: "cinephiles",
  },
  {
    review_id: "32",
    watch_id: "20",
    created_date: new Date("2026-06-14T12:00:00.000Z"),
    club_id: "6",
    club_name: "Bookworms",
    club_slug: "bookworms",
  },
];

describe("mapDiaryRows", () => {
  it("nests club review events under their parent watch, in given order", () => {
    const [solo, reviewed] = mapDiaryRows(
      [soloWatch, reviewedWatch],
      clubReviews,
    );
    expect(solo.clubReviews).toEqual([]);
    expect(reviewed.clubReviews).toEqual([
      {
        reviewId: "31",
        clubId: "5",
        clubName: "Cinephiles",
        clubSlug: "cinephiles",
        createdDate: "2026-06-13T12:00:00.000Z",
      },
      {
        reviewId: "32",
        clubId: "6",
        clubName: "Bookworms",
        clubSlug: "bookworms",
        createdDate: "2026-06-14T12:00:00.000Z",
      },
    ]);
  });

  it("carries one canonical score per watch — club events add none of their own", () => {
    const [reviewed] = mapDiaryRows([reviewedWatch], clubReviews);
    expect(reviewed.score).toBe(7.5);
    expect(reviewed.clubReviews.every((review) => !("score" in review))).toBe(
      true,
    );
  });

  it("passes an unrated (null) score through as null", () => {
    const [watch] = mapDiaryRows([soloWatch], []);
    expect(watch.score).toBeNull();
  });

  it("passes private text through, and null through as null", () => {
    const [solo, reviewed] = mapDiaryRows([soloWatch, reviewedWatch], []);
    expect(solo.text).toBe("A private note about the rewatch.");
    expect(reviewed.text).toBeNull();
  });

  it("formats watched_date as YYYY-MM-DD and null as null", () => {
    const [solo, reviewed] = mapDiaryRows([soloWatch, reviewedWatch], []);
    expect(solo.watchedDate).toBe("2026-07-01");
    expect(reviewed.watchedDate).toBeNull();
  });

  it("emits the created_date as an ISO timestamp", () => {
    const [solo] = mapDiaryRows([soloWatch], []);
    expect(solo.createdDate).toBe("2026-07-02T08:30:00.000Z");
  });

  it("accepts string date inputs (hand-written rows) and truncates them", () => {
    const [watch] = mapDiaryRows(
      [{ ...soloWatch, watched_date: "2026-07-01T00:00:00.000Z" }],
      [],
    );
    expect(watch.watchedDate).toBe("2026-07-01");
  });

  it("maps the work sub-object and rewatch flag", () => {
    const [watch] = mapDiaryRows([soloWatch], []);
    expect(watch.watchId).toBe("10");
    expect(watch.rewatch).toBe(true);
    expect(watch.work).toEqual({
      id: "100",
      title: "Solo Watched Film",
      type: WorkType.movie,
      externalId: "tt-solo",
      imageUrl: "https://img/solo.jpg",
    });
  });
});

describe("mapForWorkRows", () => {
  it("returns watches without the (known) work", () => {
    const [watch] = mapForWorkRows([soloWatch], []);
    expect("work" in watch).toBe(false);
    expect(watch).toEqual({
      watchId: "10",
      score: null,
      watchedDate: "2026-07-01",
      createdDate: "2026-07-02T08:30:00.000Z",
      rewatch: true,
      text: "A private note about the rewatch.",
      clubReviews: [],
    });
  });
});
