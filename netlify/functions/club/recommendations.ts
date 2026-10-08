import RecommendationService from "../services/RecommendationService";
import { secured } from "../utils/auth";
import { ok } from "../utils/responses";
import { Router } from "../utils/router";
import { ClubRequest } from "../utils/validation";

const router = new Router<ClubRequest>("/api/club/:clubSlug/recommendations");

// Members only: it feeds the add modal, and every call fans out to TMDB.
router.get("/", secured, async ({ clubId, clubType }, res) => {
  const recommendations = await RecommendationService.getForClub(clubId, clubType);
  return res(ok(JSON.stringify(recommendations)));
});

export default router;
