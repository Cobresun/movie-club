import ClubRepository from "../repositories/ClubRepository";
import { ok, badRequest } from "../utils/responses";
import { Router } from "../utils/router";
import { ClubRequest } from "../utils/validation";

const router = new Router<ClubRequest>("/api/club/:clubIdentifier/invite");

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
