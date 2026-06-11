/**
 * Tests for netlify/functions/services/SharedReviewService.ts
 *
 * All repository modules and the providers registry are mocked.
 */
import { vi, describe, it, expect, beforeEach } from "vitest";

import { ClubType, WorkType } from "../../../../lib/types/generated/db";
import { DetailedWorkData } from "../../../../lib/types/lists";
import ClubRepository from "../../repositories/ClubRepository";
import ListRepository from "../../repositories/ListRepository";
import ReviewRepository from "../../repositories/ReviewRepository";
import UserRepository from "../../repositories/UserRepository";
import WorkCommentRepository from "../../repositories/WorkCommentRepository";
import { getExternalDataForWorks } from "../../utils/providers";
import SharedReviewService from "../SharedReviewService";

// ─── Mock: database ───────────────────────────────────────────────────────────
vi.mock("../../utils/database", () => ({
  db: {},
  pool: {},
  dialect: {},
  getDbUrl: vi.fn(),
}));

// ─── Mock: repositories ───────────────────────────────────────────────────────
vi.mock("../../repositories/ClubRepository", () => ({
  default: {
    getById: vi.fn(),
    getBySlug: vi.fn(),
  },
}));

vi.mock("../../repositories/ListRepository", () => ({
  default: {
    getWorkDetails: vi.fn(),
  },
}));

vi.mock("../../repositories/ReviewRepository", () => ({
  default: {
    getReviewsByWorkId: vi.fn(),
  },
}));

vi.mock("../../repositories/UserRepository", () => ({
  default: {
    getMembersByClubId: vi.fn(),
  },
}));

vi.mock("../../repositories/WorkCommentRepository", () => ({
  default: {
    getByWorkAndClub: vi.fn(),
  },
}));

// ─── Mock: providers registry ─────────────────────────────────────────────────
vi.mock("../../utils/providers", () => ({
  getExternalDataForWorks: vi.fn(),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockClub = {
  id: "1",
  name: "Film Club",
  slug: "film-club",
  type: ClubType.movie,
  legacy_id: null,
  slug_updated_at: null,
};

const mockReviews = [
  {
    review_id: "rev-1",
    score: "8",
    user_id: "user-1",
    created_date: new Date("2024-01-01"),
  },
  {
    review_id: "rev-2",
    score: "7",
    user_id: "user-2",
    created_date: new Date("2024-01-02"),
  },
];

const mockMembers = [
  {
    id: "user-1",
    email: "a@example.com",
    name: "Alice",
    image: null,
    role: "admin" as const,
  },
  {
    id: "user-2",
    email: "b@example.com",
    name: "Bob",
    image: null,
    role: "member" as const,
  },
];

const mockWorkDetails = {
  id: "work-1",
  title: "Inception",
  type: WorkType.movie,
  image_url: null,
  external_id: "27205",
  time_added: new Date("2024-01-01"),
  overview: "A thief enters dreams.",
  tmdb_score: "8.4",
  runtime: "148",
  budget: "160000000",
  revenue: "836836967",
  release_date: new Date("2010-07-16"),
  adult: false,
  backdrop_path: "/backdrop.jpg",
  homepage: "https://example.com",
  imdb_id: "tt1375666",
  original_language: "en",
  original_title: "Inception",
  popularity: "87.3",
  poster_path: "/poster.jpg",
  status: "Released",
  tagline: "Your mind is the scene of the crime.",
  genres: ["Action", "Science Fiction"],
  directors: [{ name: "Christopher Nolan", profilePath: null }],
  production_companies: ["Warner Bros."],
  production_countries: ["United States of America"],
  actors: [{ name: "Leonardo DiCaprio", profilePath: null }],
};

const mockComments = [
  {
    id: "comment-1",
    workId: "work-1",
    userId: "user-1",
    userName: "Alice",
    userImage: undefined,
    content: "Great film!",
    createdDate: "2024-01-01T00:00:00.000Z",
    spoiler: false,
  },
];

// The enriched metadata the providers registry resolves for this work. Typed as
// DetailedWorkData so `new Map([...])` infers the value type the service expects.
const mockExternalData: DetailedWorkData = {
  kind: "movie",
  actors: [],
  adult: undefined,
  backdrop_path: undefined,
  budget: undefined,
  homepage: undefined,
  imdb_id: undefined,
  original_language: undefined,
  original_title: undefined,
  overview: "A thief enters dreams.",
  popularity: undefined,
  poster_path: undefined,
  release_date: undefined,
  revenue: undefined,
  runtime: undefined,
  status: undefined,
  tagline: undefined,
  vote_average: undefined,
  genres: ["Action"],
  directors: [],
  production_companies: [],
  production_countries: [],
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── getSharedReviewData ──────────────────────────────────────────────────────

describe("SharedReviewService.getSharedReviewData", () => {
  it("returns null when work is not found", async () => {
    vi.mocked(ReviewRepository.getReviewsByWorkId).mockResolvedValue([]);
    vi.mocked(UserRepository.getMembersByClubId).mockResolvedValue([]);
    vi.mocked(ListRepository.getWorkDetails).mockResolvedValue(undefined);
    vi.mocked(ClubRepository.getById).mockResolvedValue(mockClub);
    vi.mocked(WorkCommentRepository.getByWorkAndClub).mockResolvedValue([]);

    const result = await SharedReviewService.getSharedReviewData(
      "club-1",
      "work-missing",
    );

    expect(result).toBeNull();
  });

  it("returns review data when work exists", async () => {
    vi.mocked(ReviewRepository.getReviewsByWorkId).mockResolvedValue(
      mockReviews,
    );
    vi.mocked(UserRepository.getMembersByClubId).mockResolvedValue(mockMembers);
    vi.mocked(ListRepository.getWorkDetails).mockResolvedValue(mockWorkDetails);
    vi.mocked(ClubRepository.getById).mockResolvedValue(mockClub);
    vi.mocked(WorkCommentRepository.getByWorkAndClub).mockResolvedValue(
      mockComments,
    );
    vi.mocked(getExternalDataForWorks).mockResolvedValue(
      new Map([["27205", mockExternalData]]),
    );

    const result = await SharedReviewService.getSharedReviewData(
      "club-1",
      "work-1",
    );

    expect(result).not.toBeNull();
    expect(result?.reviews).toBe(mockReviews);
    expect(result?.members).toBe(mockMembers);
    expect(result?.comments).toBe(mockComments);
  });

  it("builds work object with expected shape from workDetails", async () => {
    vi.mocked(ReviewRepository.getReviewsByWorkId).mockResolvedValue([]);
    vi.mocked(UserRepository.getMembersByClubId).mockResolvedValue([]);
    vi.mocked(ListRepository.getWorkDetails).mockResolvedValue(mockWorkDetails);
    vi.mocked(ClubRepository.getById).mockResolvedValue(mockClub);
    vi.mocked(WorkCommentRepository.getByWorkAndClub).mockResolvedValue([]);
    vi.mocked(getExternalDataForWorks).mockResolvedValue(
      new Map([["27205", mockExternalData]]),
    );

    const result = await SharedReviewService.getSharedReviewData(
      "club-1",
      "work-1",
    );

    expect(result?.work.id).toBe("work-1");
    expect(result?.work.title).toBe("Inception");
    expect(result?.work.type).toBe(WorkType.movie);
    expect(result?.work.externalId).toBe("27205");
    expect(result?.work.externalData).toBe(mockExternalData);
  });

  it("work.imageUrl is undefined when image_url is null", async () => {
    vi.mocked(ReviewRepository.getReviewsByWorkId).mockResolvedValue([]);
    vi.mocked(UserRepository.getMembersByClubId).mockResolvedValue([]);
    vi.mocked(ListRepository.getWorkDetails).mockResolvedValue({
      ...mockWorkDetails,
      image_url: null,
    });
    vi.mocked(ClubRepository.getById).mockResolvedValue(mockClub);
    vi.mocked(WorkCommentRepository.getByWorkAndClub).mockResolvedValue([]);
    vi.mocked(getExternalDataForWorks).mockResolvedValue(new Map());

    const result = await SharedReviewService.getSharedReviewData(
      "club-1",
      "work-1",
    );

    expect(result?.work.imageUrl).toBeUndefined();
  });

  it("work.imageUrl is populated when image_url is a string", async () => {
    vi.mocked(ReviewRepository.getReviewsByWorkId).mockResolvedValue([]);
    vi.mocked(UserRepository.getMembersByClubId).mockResolvedValue([]);
    vi.mocked(ListRepository.getWorkDetails).mockResolvedValue({
      ...mockWorkDetails,
      image_url: "https://cdn.example.com/image.jpg",
    });
    vi.mocked(ClubRepository.getById).mockResolvedValue(mockClub);
    vi.mocked(WorkCommentRepository.getByWorkAndClub).mockResolvedValue([]);
    vi.mocked(getExternalDataForWorks).mockResolvedValue(new Map());

    const result = await SharedReviewService.getSharedReviewData(
      "club-1",
      "work-1",
    );

    expect(result?.work.imageUrl).toBe("https://cdn.example.com/image.jpg");
  });

  it("work.externalId is undefined when external_id is null", async () => {
    vi.mocked(ReviewRepository.getReviewsByWorkId).mockResolvedValue([]);
    vi.mocked(UserRepository.getMembersByClubId).mockResolvedValue([]);
    vi.mocked(ListRepository.getWorkDetails).mockResolvedValue({
      ...mockWorkDetails,
      external_id: null,
    });
    vi.mocked(ClubRepository.getById).mockResolvedValue(mockClub);
    vi.mocked(WorkCommentRepository.getByWorkAndClub).mockResolvedValue([]);
    vi.mocked(getExternalDataForWorks).mockResolvedValue(new Map());

    const result = await SharedReviewService.getSharedReviewData(
      "club-1",
      "work-1",
    );

    expect(result?.work.externalId).toBeUndefined();
  });

  it("returns null when the club is not found", async () => {
    vi.mocked(ReviewRepository.getReviewsByWorkId).mockResolvedValue([]);
    vi.mocked(UserRepository.getMembersByClubId).mockResolvedValue([]);
    vi.mocked(ListRepository.getWorkDetails).mockResolvedValue(mockWorkDetails);
    vi.mocked(ClubRepository.getById).mockResolvedValue(undefined);
    vi.mocked(WorkCommentRepository.getByWorkAndClub).mockResolvedValue([]);
    vi.mocked(getExternalDataForWorks).mockResolvedValue(new Map());

    const result = await SharedReviewService.getSharedReviewData(
      "club-1",
      "work-1",
    );

    expect(result).toBeNull();
  });

  it("clubName is club name when club is found", async () => {
    vi.mocked(ReviewRepository.getReviewsByWorkId).mockResolvedValue([]);
    vi.mocked(UserRepository.getMembersByClubId).mockResolvedValue([]);
    vi.mocked(ListRepository.getWorkDetails).mockResolvedValue(mockWorkDetails);
    vi.mocked(ClubRepository.getById).mockResolvedValue(mockClub);
    vi.mocked(WorkCommentRepository.getByWorkAndClub).mockResolvedValue([]);
    vi.mocked(getExternalDataForWorks).mockResolvedValue(new Map());

    const result = await SharedReviewService.getSharedReviewData(
      "club-1",
      "work-1",
    );

    expect(result?.clubName).toBe("Film Club");
  });

  it("calls all repositories in parallel with correct arguments", async () => {
    vi.mocked(ReviewRepository.getReviewsByWorkId).mockResolvedValue([]);
    vi.mocked(UserRepository.getMembersByClubId).mockResolvedValue([]);
    vi.mocked(ListRepository.getWorkDetails).mockResolvedValue(mockWorkDetails);
    vi.mocked(ClubRepository.getById).mockResolvedValue(mockClub);
    vi.mocked(WorkCommentRepository.getByWorkAndClub).mockResolvedValue([]);
    vi.mocked(getExternalDataForWorks).mockResolvedValue(new Map());

    await SharedReviewService.getSharedReviewData("club-42", "work-99");

    expect(ReviewRepository.getReviewsByWorkId).toHaveBeenCalledWith(
      "club-42",
      "work-99",
    );
    expect(UserRepository.getMembersByClubId).toHaveBeenCalledWith("club-42");
    expect(ListRepository.getWorkDetails).toHaveBeenCalledWith("work-99");
    expect(ClubRepository.getById).toHaveBeenCalledWith("club-42");
    expect(WorkCommentRepository.getByWorkAndClub).toHaveBeenCalledWith(
      "work-99",
      "club-42",
    );
  });

  it("calls getExternalDataForWorks with the work's external id and type", async () => {
    vi.mocked(ReviewRepository.getReviewsByWorkId).mockResolvedValue([]);
    vi.mocked(UserRepository.getMembersByClubId).mockResolvedValue([]);
    vi.mocked(ListRepository.getWorkDetails).mockResolvedValue(mockWorkDetails);
    vi.mocked(ClubRepository.getById).mockResolvedValue(mockClub);
    vi.mocked(WorkCommentRepository.getByWorkAndClub).mockResolvedValue([]);
    vi.mocked(getExternalDataForWorks).mockResolvedValue(new Map());

    await SharedReviewService.getSharedReviewData("club-1", "work-1");

    expect(getExternalDataForWorks).toHaveBeenCalledWith([
      { externalId: "27205", type: WorkType.movie },
    ]);
  });
});
