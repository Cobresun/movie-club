import { Router } from "itty-router";

import ClubRepository from "../repositories/ClubRepository";
import { ok, badRequest } from "../utils/responses";
import { ClubRequest } from "../utils/validation";

const router = Router<ClubRequest>({ base: "/api/club/:clubId/invite" });

router.post("/", async ({ clubId }) => {
  try {
    const token = await ClubRepository.createClubInvite(clubId);
    return ok(JSON.stringify({ token }));
  } catch (error) {
    console.error("Error creating invite:", error);
    return badRequest("Failed to create invite");
  }
});

export default router;
