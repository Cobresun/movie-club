import { z } from "zod";

import { hasValue, isDefined } from "../../../lib/checks/checks.js";
import { ReviewScores } from "../../../lib/types/lists";
import ListRepository from "../repositories/ListRepository";
import ReviewRepository from "../repositories/ReviewRepository";
import SettingsRepository from "../repositories/SettingsRepository";
import UserRepository from "../repositories/UserRepository";
import WorkCommentRepository from "../repositories/WorkCommentRepository";
import WorkRepository from "../repositories/WorkRepository";
import SharedReviewService from "../services/SharedReviewService";
import { secured } from "../utils/auth";
import { generateJson } from "../utils/gemini";
import { getProvider } from "../utils/providers";
import { badRequest, ok, unauthorized } from "../utils/responses";
import { Router } from "../utils/router";
import { ClubRequest } from "../utils/validation";

const router = new Router<ClubRequest>("/api/club/:clubSlug/reviews");

const addReviewSchema = z.object({
  score: z.number().min(0).max(10),
  workId: z.string(),
});

router.post("/", secured, async ({ clubId, userId, event }, res) => {
  if (!hasValue(event.body)) return res(badRequest("No body provided"));
  const body = addReviewSchema.safeParse(JSON.parse(event.body));
  if (!body.success) return res(badRequest("Invalid body"));

  const { score, workId } = body.data;

  const reviewsListId = await ListRepository.getReviewsListId(clubId);
  const exists = await ListRepository.isItemInList(reviewsListId, workId);
  if (!exists) {
    return res(badRequest("This movie does not exist in the list"));
  }

  await ReviewRepository.insertReview(clubId, workId, userId, score);
  return res(ok());
});

const updateReviewSchema = z.object({
  score: z.number().min(0).max(10),
});

router.put(
  `/:reviewId`,
  secured,
  async ({ clubId, userId, params, event }, res) => {
    if (!hasValue(params.reviewId)) {
      return res(badRequest("No reviewId provided"));
    }
    if (!hasValue(event.body)) return res(badRequest("No body provided"));
    const body = updateReviewSchema.safeParse(JSON.parse(event.body));
    if (!body.success) return res(badRequest("Invalid body"));

    const { score } = body.data;
    const reviewId = params.reviewId;
    const review = await ReviewRepository.getById(reviewId, clubId);
    if (review.user_id !== userId) {
      return res(badRequest("You are not allowed to edit this review"));
    }
    await ReviewRepository.updateScore(reviewId, score);
    return res(ok());
  },
);

// Comment endpoints

const addCommentSchema = z.object({
  content: z.string().min(1).max(2000),
  spoiler: z.boolean().optional().default(false),
});

router.get("/:workId/comments", secured, async ({ clubId, params }, res) => {
  if (!hasValue(params.workId)) {
    return res(badRequest("No workId provided"));
  }
  const comments = await WorkCommentRepository.getByWorkAndClub(
    params.workId,
    clubId,
  );
  return res(ok(JSON.stringify(comments)));
});

router.post(
  "/:workId/comments",
  secured,
  async ({ clubId, userId, params, event }, res) => {
    if (!hasValue(params.workId)) {
      return res(badRequest("No workId provided"));
    }
    if (!hasValue(event.body)) return res(badRequest("No body provided"));
    const body = addCommentSchema.safeParse(JSON.parse(event.body));
    if (!body.success) return res(badRequest("Invalid body"));

    await WorkCommentRepository.insert(
      params.workId,
      clubId,
      userId,
      body.data.content,
      body.data.spoiler,
    );
    return res(ok());
  },
);

const updateCommentSchema = z.object({
  content: z.string().min(1).max(2000),
  spoiler: z.boolean().optional(),
});

router.put(
  "/:workId/comments/:commentId",
  secured,
  async ({ userId, params, event }, res) => {
    if (!hasValue(params.workId) || !hasValue(params.commentId)) {
      return res(badRequest("Missing parameters"));
    }
    if (!hasValue(event.body)) return res(badRequest("No body provided"));
    const body = updateCommentSchema.safeParse(JSON.parse(event.body));
    if (!body.success) return res(badRequest("Invalid body"));

    const comment = await WorkCommentRepository.getById(params.commentId);
    if (!comment) {
      return res(badRequest("Comment not found"));
    }
    if (comment.user_id !== userId) {
      return res(unauthorized("You can only edit your own comments"));
    }

    await WorkCommentRepository.updateContent(
      params.commentId,
      userId,
      body.data.content,
      body.data.spoiler,
    );
    return res(ok());
  },
);

router.delete(
  "/:workId/comments/:commentId",
  secured,
  async ({ userId, params }, res) => {
    if (!hasValue(params.workId) || !hasValue(params.commentId)) {
      return res(badRequest("Missing parameters"));
    }
    const comment = await WorkCommentRepository.getById(params.commentId);
    if (!comment) {
      return res(badRequest("Comment not found"));
    }
    if (comment.user_id !== userId) {
      return res(unauthorized("You can only delete your own comments"));
    }
    await WorkCommentRepository.deleteById(params.commentId);
    return res(ok());
  },
);

const discussionQuestionsSchema = z.object({
  questions: z.array(z.string().min(1)).max(5),
});

router.post(
  "/:workId/discussion-questions",
  secured,
  async ({ clubId, params }, res) => {
    if (!hasValue(params.workId)) {
      return res(badRequest("No workId provided"));
    }

    const settings = await SettingsRepository.getSettings(clubId);
    if (settings.features.discussionQuestions !== true) {
      return res(badRequest("Feature not enabled"));
    }

    // Resolve the work server-side from the workId so the prompt can't be
    // poisoned by client-supplied input. The work's provider owns the
    // type-specific metadata lookup and prompt wording.
    const work = await WorkRepository.getById(clubId, params.workId);
    if (!work) {
      return res(badRequest("Work not found"));
    }

    const prompt = await getProvider(work.type).getDiscussionPrompt({
      title: work.title,
      externalId: work.external_id,
    });

    const { questions } = await generateJson({
      prompt,
      schema: discussionQuestionsSchema,
      responseSchema: {
        type: "object",
        properties: {
          questions: {
            type: "array",
            items: { type: "string" },
            maxItems: 5,
          },
        },
        required: ["questions"],
      },
      temperature: 0.9,
    });
    return res(ok(JSON.stringify({ questions })));
  },
);

// Lightweight per-work scores endpoint. Returns only the `scores` map (one entry
// per member plus a synthetic `average`) for a single work, so clients can poll
// it cheaply to pick up other members' scores during a synchronized scoring
// session without refetching the whole reviews list (posters, metadata, etc.).
router.get("/:workId/scores", secured, async ({ clubId, params }, res) => {
  if (!hasValue(params.workId)) {
    return res(badRequest("No workId provided"));
  }
  const scores = await buildWorkScores(clubId, params.workId);
  return res(ok(JSON.stringify(scores)));
});

// Mirrors the per-work grouping in `club/list.ts` getReviewList, scoped to a
// single work. Filters to current members so a departed member's stale score
// doesn't reappear, and appends the average.
async function buildWorkScores(
  clubId: string,
  workId: string,
): Promise<ReviewScores> {
  const [reviews, members] = await Promise.all([
    ReviewRepository.getReviewsByWorkId(clubId, workId),
    UserRepository.getMembersByClubId(clubId),
  ]);
  const memberIds = new Set(members.map((member) => member.id));

  const userScores = reviews.reduce<ReviewScores>((acc, review) => {
    if (
      hasValue(review.user_id) &&
      hasValue(review.review_id) &&
      hasValue(review.score) &&
      isDefined(review.created_date) &&
      memberIds.has(review.user_id)
    ) {
      acc[review.user_id] = {
        id: review.review_id,
        created_date: review.created_date.toISOString(),
        score: parseFloat(review.score),
      };
    }
    return acc;
  }, {});

  const entries = Object.values(userScores);
  if (entries.length === 0) return {};

  return {
    ...userScores,
    average: {
      id: "average",
      created_date: new Date().toISOString(),
      score:
        entries.reduce((sum, review) => sum + review.score, 0) / entries.length,
    },
  };
}

router.get("/:workId/shared", async ({ clubId, params }, res) => {
  if (!hasValue(params.workId)) {
    return res(badRequest("No workId provided"));
  }

  const workId = params.workId;
  const sharedReviewData = await SharedReviewService.getSharedReviewData(
    clubId,
    workId,
  );

  if (!sharedReviewData) {
    return res(badRequest("Work not found"));
  }

  return res(ok(JSON.stringify(sharedReviewData)));
});

export default router;
