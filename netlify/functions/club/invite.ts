import ClubRepository from "../repositories/ClubRepository.js";
import { ok, badRequest } from "../utils/responses.js";
import { Router } from "../utils/router.js";
import { ClubRequest } from "../utils/validation.js";

const router = new Router<ClubRequest>("/api/club/:clubSlug/invite");

router.post("/", async ({ clubId }, res) => {
  try {
    const token = await ClubRepository.createClubInvite(clubId);
    return res(ok(JSON.stringify({ token })));
  } catch (error) {
    console.error("Error creating invite:", error);
    return res(badRequest("Failed to create invite"));
  }
});

export default router;
