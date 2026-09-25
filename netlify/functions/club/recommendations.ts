import RecommendationService from "../services/RecommendationService";
import { secured } from "../utils/auth";
import { ok } from "../utils/responses";
import { Router } from "../utils/router";
import { ClubRequest } from "../utils/validation";

const router = new Router<ClubRequest>("/api/club/:clubSlug/recommendations");

// Members only: the ranking draws on members' scores from their other clubs.
router.get("/", secured, async ({ clubId, clubType, userId }, res) => {
  const recommendations = await RecommendationService.getForClub(clubId, clubType, userId);
  return res(ok(JSON.stringify(recommendations)));
});

export default router;
